import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// src/adapters/SupabaseAdapter.ts
var SupabaseAdapter = class {
  supabase;
  constructor(opts) {
    this.supabase = createClient(opts.supabaseUrl, opts.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  async listPendingJobs(limit) {
    const { data, error } = await this.supabase.from("job_queue").select("id,status,type,payload,attempts,last_error,locked_at,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => this.toJobRecord(r));
  }
  async claimJob(jobId) {
    const { data, error } = await this.supabase.from("job_queue").update({
      status: "processing",
      locked_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", jobId).eq("status", "pending").select("id,status,type,payload,attempts,last_error,locked_at,created_at").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    await this.supabase.from("job_queue").update({ attempts: data.attempts + 1, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", jobId);
    return this.toJobRecord(data);
  }
  async markCompleted(jobId, result) {
    const { error } = await this.supabase.from("job_queue").update({
      status: "completed",
      result,
      last_error: null,
      completed_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", jobId);
    if (error) throw error;
  }
  async markFailed(jobId, errorMessage) {
    const { error } = await this.supabase.from("job_queue").update({
      status: "failed",
      last_error: errorMessage,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", jobId);
    if (error) throw error;
  }
  async downloadFromStorage(bucket, path) {
    const { data, error } = await this.supabase.storage.from(bucket).download(path);
    if (error) throw error;
    if (!data) throw new Error("Storage download returned empty data");
    const anyData = data;
    if (Buffer.isBuffer(anyData)) return anyData;
    if (typeof anyData?.arrayBuffer === "function") {
      const ab = await anyData.arrayBuffer();
      return Buffer.from(ab);
    }
    if (anyData instanceof ArrayBuffer) return Buffer.from(anyData);
    throw new Error("Unsupported storage download data type");
  }
  async requeueStaleProcessingJobs(staleBeforeIso) {
    const { data, error } = await this.supabase.from("job_queue").update({
      status: "pending",
      locked_at: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("status", "processing").lt("locked_at", staleBeforeIso).select("id");
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
  }
  async insertLearningMaterialDraft(input) {
    const { data, error } = await this.supabase.from("learning_materials").insert({
      course_id: input.courseId,
      file_name: input.fileName,
      file_path: input.filePath,
      topic_name: input.topicName
    }).select("id").single();
    if (error) throw error;
    return Number(data.id);
  }
  async replaceQuestionsForMaterial(input) {
    const { error: delErr } = await this.supabase.from("questions").delete().eq("material_id", input.materialId);
    if (delErr) throw delErr;
    const rows = input.questions.map((q) => ({
      course_id: input.courseId,
      material_id: input.materialId,
      question_text: q.question_text,
      choices: q.choices,
      correct_answer: q.correct_answer,
      bloom_level: q.bloom_level ?? null
    }));
    const { error: insErr } = await this.supabase.from("questions").insert(rows);
    if (insErr) throw insErr;
  }
  toJobRecord(row) {
    return {
      id: row.id,
      status: row.status,
      type: row.type,
      payload: row.payload,
      attempts: row.attempts ?? 0,
      last_error: row.last_error ?? null,
      locked_at: row.locked_at ?? null,
      created_at: row.created_at
    };
  }
};

// src/domain/validation.ts
function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const q = item;
    const question_text = typeof q?.question_text === "string" ? q.question_text.trim() : "";
    const choices = Array.isArray(q?.choices) ? q.choices.map((c) => String(c).trim()) : [];
    const correct_answer = typeof q?.correct_answer === "string" ? q.correct_answer.trim() : "";
    const bloom_level = typeof q?.bloom_level === "string" ? q.bloom_level.trim() : "";
    if (!question_text || choices.length < 2 || !correct_answer) continue;
    out.push({ question_text, choices, correct_answer, bloom_level });
  }
  return out;
}
function distributeAnswerPositions(questions) {
  return questions.map((q, idx) => {
    const choices = [...q.choices];
    const correctIdx = choices.indexOf(q.correct_answer);
    if (correctIdx === -1) return q;
    const targetPos = idx % choices.length;
    if (correctIdx !== targetPos) {
      const tmp = choices[targetPos];
      choices[targetPos] = choices[correctIdx];
      choices[correctIdx] = tmp;
    }
    return { ...q, choices };
  });
}

// src/adapters/OpenAIAdapter.ts
var OpenAIAdapter = class {
  client;
  model;
  // CRITICAL: token bucket history (rolling 60s window)
  tokenHistory = [];
  constructor(opts) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? "gpt-4o-mini";
  }
  estimateTokens(textChunk) {
    return Math.ceil(String(textChunk ?? "").length / 4);
  }
  async throttleForText(textChunk) {
    const estimatedTokens = this.estimateTokens(textChunk);
    const now = Date.now();
    this.tokenHistory = this.tokenHistory.filter((r) => now - r.timestamp <= 6e4);
    const currentTpm = this.tokenHistory.reduce((sum, r) => sum + r.tokens, 0);
    if (currentTpm + estimatedTokens > 18e4) {
      const oldestRecord = this.tokenHistory[0];
      if (!oldestRecord) {
        await new Promise((resolve2) => setTimeout(resolve2, 250));
        return this.throttleForText(textChunk);
      }
      const waitTime = 6e4 - (now - oldestRecord.timestamp);
      if (waitTime > 0) {
        console.warn(
          `[openai][throttle] waiting ${waitTime}ms (window=${currentTpm} + est=${estimatedTokens} > 180000)`
        );
        await new Promise((resolve2) => setTimeout(resolve2, waitTime));
      }
      return this.throttleForText(textChunk);
    }
    this.tokenHistory.push({ timestamp: Date.now(), tokens: estimatedTokens });
  }
  async mapChunkToNotes(prompt) {
    console.log(`[openai] mapChunkToNotes estTokens=${this.estimateTokens(prompt)}`);
    await this.throttleForText(prompt);
    const jsonSchema = {
      name: "chunk_notes",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          notes: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["notes"]
      }
    };
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: jsonSchema }
    });
    const content = res.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const notes = Array.isArray(parsed?.notes) ? parsed.notes.map((n) => String(n)) : [];
    return { notes };
  }
  async reduceNotesToQuestions(prompt) {
    console.log(`[openai] reduceNotesToQuestions estTokens=${this.estimateTokens(prompt)}`);
    await this.throttleForText(prompt);
    const jsonSchema = {
      name: "quiz_questions",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          questions: {
            type: "array",
            minItems: 20,
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                question_text: { type: "string" },
                choices: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 4
                },
                correct_answer: { type: "string" },
                bloom_level: { type: "string" }
              },
              required: ["question_text", "choices", "correct_answer", "bloom_level"]
            }
          }
        },
        required: ["questions"]
      }
    };
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: jsonSchema }
    });
    const content = res.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const out = normalizeQuestions(parsed?.questions || []);
    if (out.length !== 20) {
      throw new Error(`OpenAI returned ${out.length} valid questions (expected exactly 20).`);
    }
    return out;
  }
  async generateQuestions(input) {
    if (input.kind !== "text") {
      throw new Error(
        "OpenAIAdapter currently supports text inputs for map-reduce. Provide `text` in the job payload (PDF must be pre-extracted to text)."
      );
    }
    const notes = await this.mapChunkToNotes(input.text);
    const prompt = [
      "Using the notes below, generate 20 multiple-choice questions.",
      "Return ONLY JSON as an array.",
      "Notes:",
      ...notes.notes.map((n) => `- ${n}`)
    ].join("\n");
    return this.reduceNotesToQuestions(prompt);
  }
};

// src/adapters/MockLLMAdapter.ts
function sleep(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
var MockLLMAdapter = class {
  async mapChunkToNotes(_prompt) {
    console.log("\u{1F6E0}\uFE0F [MOCK LLM] Simulating 3s latency for method: mapChunkToNotes...");
    await sleep(3e3);
    return {
      notes: [
        "Definition: spaced repetition improves long-term recall.",
        "Rule: correct answers must appear among choices.",
        "Key idea: keep questions short and fast."
      ]
    };
  }
  async reduceNotesToQuestions(_prompt) {
    console.log("\u{1F6E0}\uFE0F [MOCK LLM] Simulating 3s latency for method: reduceNotesToQuestions...");
    await sleep(3e3);
    return [
      {
        question_text: "What improves long-term recall?",
        choices: ["Spaced repetition", "Cramming", "Guessing", "Skipping"],
        correct_answer: "Spaced repetition",
        bloom_level: "Understand"
      },
      {
        question_text: "Which choice rule is correct?",
        choices: ["Include correct answer", "Hide correct answer", "Use duplicates", "Use long options"],
        correct_answer: "Include correct answer",
        bloom_level: "Remember"
      }
    ];
  }
  async generateQuestions(_input) {
    console.log("\u{1F6E0}\uFE0F [MOCK LLM] Simulating 3s latency for method: generateQuestions...");
    await sleep(3e3);
    return [
      {
        question_text: "What is the best study method here?",
        choices: ["Spaced repetition", "All-nighter", "Random review", "No review"],
        correct_answer: "Spaced repetition",
        bloom_level: "Apply"
      },
      {
        question_text: "How many options are typical?",
        choices: ["4", "1", "10", "0"],
        correct_answer: "4",
        bloom_level: "Remember"
      }
    ];
  }
};
var PdfParseTextExtractorAdapter = class {
  async extractTextFromPdf(buffer) {
    const parser = new PDFParse({ data: buffer });
    try {
      const res = await parser.getText();
      return String(res.text ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    } finally {
      await parser.destroy().catch(() => {
      });
    }
  }
};

// src/domain/chunking.ts
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function chunkText(text, opts) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const target = 6e3;
  const min = clamp(3500, 500, target);
  const max = clamp(8500, target, 2e4);
  const paragraphs = normalized.split("\n\n");
  const chunks = [];
  let buf = "";
  const pushBuf = () => {
    const t = buf.trim();
    if (!t) return;
    chunks.push({ index: chunks.length, text: t });
    buf = "";
  };
  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if (!buf) {
      buf = para;
      continue;
    }
    if (buf.length + 2 + para.length <= target) {
      buf = `${buf}

${para}`;
      continue;
    }
    if (buf.length >= min) {
      pushBuf();
      buf = para;
      continue;
    }
    if (buf.length + 2 + para.length <= max) {
      buf = `${buf}

${para}`;
      continue;
    }
    const combined = `${buf}

${para}`;
    let i = 0;
    while (i < combined.length) {
      const slice = combined.slice(i, i + target);
      chunks.push({ index: chunks.length, text: slice.trim() });
      i += target;
    }
    buf = "";
  }
  pushBuf();
  return chunks;
}

// src/domain/prompts.ts
function mapPromptForChunk(chunk) {
  return [
    "You are extracting study facts from a document chunk.",
    "Return ONLY JSON.",
    "",
    "JSON schema:",
    `{ "notes": string[], "keywords": string[] }`,
    "",
    "Rules:",
    "- Notes must be concise (<= 18 words each).",
    "- Prefer definitions, formulas, rules, and key distinctions.",
    "- Avoid duplicates and filler.",
    "",
    `Chunk #${chunk.index}:`,
    chunk.text
  ].join("\n");
}
function reducePromptForQuestions(allNotes) {
  return [
    "Using the notes below, generate EXACTLY 20 multiple-choice questions (not 19, not 21).",
    "Return ONLY JSON as an array of 20 objects with fields:",
    `question_text (string), choices (string[4]), correct_answer (string), bloom_level (string)`,
    "",
    "CRITICAL CONSTRAINTS:",
    "- question_text under 20 words",
    "- exactly 4 choices per question",
    "- each choice under 5 words",
    "- answerable within 10 seconds",
    "- distribute correct answers evenly across A/B/C/D",
    "- keep choices mutually exclusive",
    "",
    "Notes:",
    ...allNotes.map((n) => `- ${n}`)
  ].join("\n");
}

// src/application/ProcessQuizUseCase.ts
var ProcessQuizUseCase = class {
  constructor(db, llm, textExtractor) {
    this.db = db;
    this.llm = llm;
    this.textExtractor = textExtractor;
  }
  db;
  llm;
  textExtractor;
  log(jobId, message) {
    console.log(`[job ${jobId}] ${message}`);
  }
  estimateTokens(text) {
    return Math.ceil(String(text ?? "").length / 4);
  }
  async processOne(job) {
    const claimed = await this.db.claimJob(job.id);
    if (!claimed) return;
    const t0 = Date.now();
    try {
      const payload = claimed.payload ?? {};
      let text = typeof payload.text === "string" ? payload.text : "";
      const pdfBase64 = typeof payload.pdfBase64 === "string" ? payload.pdfBase64 : "";
      const storageBucket = typeof payload.storageBucket === "string" ? payload.storageBucket : "";
      const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : "";
      const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
      const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
      this.log(
        claimed.id,
        `started. type=${claimed.type} file=${fileName || "n/a"} storage=${storageBucket || "n/a"}/${storagePath || "n/a"}`
      );
      if (!text && !pdfBase64 && !(storageBucket && storagePath)) {
        throw new Error(
          "Job payload must include `text`, `pdfBase64`, or (`storageBucket` + `storagePath`)"
        );
      }
      let resolvedPdfBase64 = pdfBase64;
      let resolvedMimeType = mimeType || "application/pdf";
      if (!text && !resolvedPdfBase64 && storageBucket && storagePath) {
        this.log(claimed.id, `downloading PDF from storage (${storageBucket}/${storagePath})...`);
        const buf = await this.db.downloadFromStorage(storageBucket, storagePath);
        this.log(claimed.id, `downloaded PDF bytes=${buf.byteLength}`);
        resolvedPdfBase64 = buf.toString("base64");
        resolvedMimeType = mimeType || "application/pdf";
      }
      if (!text) {
        if (resolvedMimeType !== "application/pdf") {
          throw new Error(`Unsupported mimeType for extraction: ${resolvedMimeType}`);
        }
        const pdfBuffer = resolvedPdfBase64 ? Buffer.from(resolvedPdfBase64, "base64") : storageBucket && storagePath ? await this.db.downloadFromStorage(storageBucket, storagePath) : null;
        if (!pdfBuffer) {
          throw new Error("No PDF buffer available for extraction");
        }
        this.log(claimed.id, "extracting text from PDF...");
        text = await this.textExtractor.extractTextFromPdf(pdfBuffer);
        this.log(claimed.id, `extracted text chars=${text.length} estTokens=${this.estimateTokens(text)}`);
        if (!text) throw new Error("Extracted PDF text is empty");
      }
      this.log(claimed.id, "chunking text...");
      const chunks = chunkText(text);
      this.log(claimed.id, `chunked into ${chunks.length} chunk(s)`);
      const notes = [];
      for (const c of chunks) {
        const prompt = mapPromptForChunk(c);
        this.log(
          claimed.id,
          `map chunk #${c.index} chars=${c.text.length} promptEstTokens=${this.estimateTokens(prompt)}`
        );
        const mapped = await this.llm.mapChunkToNotes(prompt);
        this.log(claimed.id, `map chunk #${c.index} notes=${mapped.notes?.length ?? 0}`);
        for (const n of mapped.notes ?? []) {
          const s = String(n).trim();
          if (s) notes.push(s);
        }
      }
      const reducePrompt = reducePromptForQuestions(notes.slice(0, 250));
      this.log(
        claimed.id,
        `reduce notes=${notes.length} reducePromptEstTokens=${this.estimateTokens(reducePrompt)}`
      );
      const questionsRaw = await this.llm.reduceNotesToQuestions(reducePrompt);
      const questions = distributeAnswerPositions(questionsRaw);
      this.log(claimed.id, `reduce produced questions=${questions.length}`);
      if (!questions.length) {
        throw new Error(
          "No valid questions were produced (map-reduce produced empty output)."
        );
      }
      const courseIdNum = payload.courseId != null && payload.courseId !== "" ? Number(payload.courseId) : NaN;
      let materialIdNum;
      if (Number.isFinite(courseIdNum) && storagePath && fileName && !payload.materialId) {
        try {
          const topicSeed = fileName.replace(/\.pdf$/i, "").trim() || fileName;
          this.log(claimed.id, `creating learning_materials draft topic="${topicSeed}"...`);
          materialIdNum = await this.db.insertLearningMaterialDraft({
            courseId: courseIdNum,
            fileName,
            filePath: storagePath,
            topicName: topicSeed
          });
          this.log(claimed.id, `created learning_materials id=${materialIdNum}`);
        } catch (e) {
          console.error("[worker] insertLearningMaterialDraft failed:", e);
        }
      }
      const finalMaterialId = payload.materialId != null && payload.materialId !== "" ? Number(payload.materialId) : materialIdNum;
      if (Number.isFinite(courseIdNum) && finalMaterialId && Number.isFinite(finalMaterialId)) {
        this.log(
          claimed.id,
          `saving questions to DB courseId=${courseIdNum} materialId=${finalMaterialId}...`
        );
        await this.db.replaceQuestionsForMaterial({
          courseId: courseIdNum,
          materialId: finalMaterialId,
          questions: questions.map((q) => ({
            question_text: q.question_text,
            choices: q.choices,
            correct_answer: q.correct_answer,
            bloom_level: q.bloom_level
          }))
        });
        this.log(claimed.id, "saved questions to DB");
      }
      const result = {
        questions: questions.map((q) => ({
          question_text: q.question_text,
          choices: q.choices,
          correct_answer: q.correct_answer,
          bloom_level: q.bloom_level
        })),
        meta: {
          courseId: payload.courseId,
          materialId: payload.materialId ?? (materialIdNum != null ? String(materialIdNum) : void 0),
          questionsSaved: Number.isFinite(courseIdNum) && (payload.materialId != null || materialIdNum != null)
        }
      };
      await this.db.markCompleted(claimed.id, result);
      this.log(claimed.id, `completed in ${Date.now() - t0}ms`);
    } catch (err) {
      const msg = String(err?.message || err);
      this.log(claimed.id, `failed after ${Date.now() - t0}ms: ${msg}`);
      await this.db.markFailed(claimed.id, msg);
    }
  }
};
var __filename$1 = fileURLToPath(import.meta.url);
var __dirname$1 = dirname(__filename$1);
function loadWorkerEnv() {
  const root = resolve(__dirname$1, "..");
  config({ path: resolve(root, ".env") });
  config({ path: resolve(root, ".env.local") });
}

// src/index.ts
loadWorkerEnv();
function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing Supabase URL: set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in worker/.env.local"
    );
  }
  return url;
}
function numEnv(name, fallback) {
  const raw = process.env[name];
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) ? n : fallback;
}
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    const fn = queue.shift();
    if (fn) fn();
  };
  return async function run(task) {
    if (active >= limit) {
      await new Promise((resolve2) => queue.push(resolve2));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      next();
    }
  };
}
function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 6e4).toISOString();
}
async function main() {
  const db = new SupabaseAdapter({
    supabaseUrl: getSupabaseUrl(),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY")
  });
  const isDev = process.env.NODE_ENV !== "production";
  const llm = isDev ? new MockLLMAdapter() : new OpenAIAdapter({
    apiKey: getEnv("OPENAI_API_KEY"),
    model: "gpt-4o-mini"
  });
  const textExtractor = new PdfParseTextExtractorAdapter();
  const useCase = new ProcessQuizUseCase(db, llm, textExtractor);
  const pollIntervalMs = numEnv("POLL_INTERVAL_MS", 5e3);
  const maxConcurrentJobs = Math.max(1, Math.min(5, numEnv("MAX_CONCURRENT_JOBS", 5)));
  const runLimited = createLimiter(maxConcurrentJobs);
  const staleProcessingMinutes = Math.max(1, numEnv("STALE_PROCESSING_MINUTES", 15));
  let tickRunning = false;
  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      const requeued = await db.requeueStaleProcessingJobs(minutesAgoIso(staleProcessingMinutes));
      if (requeued > 0) {
        console.warn(`[worker] requeued ${requeued} stale processing jobs`);
      }
      const pending = await db.listPendingJobs(maxConcurrentJobs * 3);
      const batch = pending.slice(0, maxConcurrentJobs);
      if (batch.length > 0) {
        console.log(
          `[worker] claiming up to ${batch.length} job(s): ${batch.map((j) => j.id).join(", ")}`
        );
      }
      await Promise.allSettled(
        batch.map(
          (job) => runLimited(async () => {
            await useCase.processOne(job);
          })
        )
      );
    } catch (err) {
      console.error("[worker] tick error:", err);
    } finally {
      tickRunning = false;
    }
  };
  await tick();
  setInterval(tick, pollIntervalMs);
  console.log(
    `[worker] started. poll=${pollIntervalMs}ms maxConcurrent=${maxConcurrentJobs}. Env loaded from worker/.env*`
  );
}
main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map