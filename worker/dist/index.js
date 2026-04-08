import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
    "Using the notes below, generate 20 multiple-choice questions.",
    "Return ONLY JSON as an array of objects with fields:",
    `question_text (string), choices (string[4]), correct_answer (string), bloom_level (string)`,
    "",
    "CRITICAL CONSTRAINTS:",
    "- question_text under 20 words",
    "- each choice under 5 words",
    "- answerable within 10 seconds",
    "- distribute correct answers evenly across A/B/C/D",
    "- keep choices mutually exclusive",
    "",
    "Notes:",
    ...allNotes.map((n) => `- ${n}`)
  ].join("\n");
}

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

// src/adapters/GeminiAdapter.ts
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function isRateLimitError(err) {
  const msg = String(err?.message || err);
  return msg.includes("429") || msg.toLowerCase().includes("rate");
}
var GeminiAdapter = class {
  genAI;
  minDelayMs;
  maxRetries;
  lastCallAt = 0;
  constructor(opts) {
    this.genAI = new GoogleGenerativeAI(opts.apiKey);
    this.minDelayMs = Math.max(0, opts.minDelayMs);
    this.maxRetries = Math.max(0, opts.maxRetries);
  }
  async generateQuestions(input) {
    const notes = await this.mapReduceNotes(input);
    let questions = notes.length > 0 ? await this.reduceNotesToQuestions(notes) : [];
    if (questions.length === 0 && input.kind === "pdfBase64" && input.base64?.length > 0) {
      questions = await this.generateQuestionsDirectFromPdf(input);
    }
    return distributeAnswerPositions(questions);
  }
  async mapReduceNotes(input) {
    if (input.kind === "text") {
      const chunks = chunkText(input.text);
      const notes2 = [];
      for (const c of chunks) {
        const json = await this.callJsonWithBackoff(
          () => this.generateJsonFromText(mapPromptForChunk(c))
        );
        const n = Array.isArray(json?.notes) ? json.notes : [];
        for (const item of n) {
          const s = String(item).trim();
          if (s) notes2.push(s);
        }
      }
      return notes2;
    }
    const pdfNotesJson = await this.callJsonWithBackoff(() => this.generateNotesFromPdf(input));
    const notes = Array.isArray(pdfNotesJson?.notes) ? pdfNotesJson.notes : [];
    return notes.map((n) => String(n).trim()).filter(Boolean);
  }
  async reduceNotesToQuestions(notes) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question_text: { type: SchemaType.STRING },
              choices: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correct_answer: { type: SchemaType.STRING },
              bloom_level: { type: SchemaType.STRING }
            },
            required: ["question_text", "choices", "correct_answer", "bloom_level"]
          }
        }
      }
    });
    const prompt = reducePromptForQuestions(notes.slice(0, 250));
    const json = await this.callJsonWithBackoff(async () => {
      await this.pace();
      const res = await model.generateContent([prompt]);
      return JSON.parse(res.response.text());
    });
    return normalizeQuestions(json);
  }
  async generateJsonFromText(prompt) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    await this.pace();
    const res = await model.generateContent([prompt]);
    return JSON.parse(res.response.text());
  }
  async generateNotesFromPdf(input) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    await this.pace();
    const res = await model.generateContent([
      {
        inlineData: {
          data: input.base64,
          mimeType: input.mimeType ?? "application/pdf"
        }
      },
      [
        "Extract concise study notes from this PDF.",
        'Return ONLY JSON with schema: { "notes": string[] }',
        "Rules:",
        "- Notes must be concise (<= 18 words each)",
        "- Prefer definitions, formulas, rules, key distinctions",
        "- Avoid duplicates"
      ].join("\n")
    ]);
    return JSON.parse(res.response.text());
  }
  /**
   * When map→reduce yields no notes or no valid questions, generate MCQs in one structured call.
   */
  async generateQuestionsDirectFromPdf(input) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question_text: { type: SchemaType.STRING },
              choices: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING }
              },
              correct_answer: { type: SchemaType.STRING },
              bloom_level: { type: SchemaType.STRING }
            },
            required: ["question_text", "choices", "correct_answer", "bloom_level"]
          }
        }
      }
    });
    const json = await this.callJsonWithBackoff(async () => {
      await this.pace();
      const res = await model.generateContent([
        {
          inlineData: {
            data: input.base64,
            mimeType: input.mimeType ?? "application/pdf"
          }
        },
        `Generate 20 multiple-choice questions based on this document.

CRITICAL CONSTRAINTS:

Brevity: The question stem must be under 20 words. The options must be under 5 words.

Speed: The question must be readable and answerable within 10 seconds.

Bloom's Taxonomy: Create a mix of levels, BUT convert higher-order scenarios into concise formats.

Answer Position: Distribute the correct answer evenly across all positions (A, B, C, D).

Output Format: JSON array only.`
      ]);
      return JSON.parse(res.response.text());
    });
    return normalizeQuestions(json);
  }
  async pace() {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastCallAt = Date.now();
  }
  async callJsonWithBackoff(fn) {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt > this.maxRetries || !isRateLimitError(err)) throw err;
        const base = Math.min(1e4, 500 * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * 250);
        await sleep(base + jitter);
      }
    }
  }
};

// src/application/ProcessQuizUseCase.ts
var ProcessQuizUseCase = class {
  constructor(db, llm) {
    this.db = db;
    this.llm = llm;
  }
  db;
  llm;
  async processOne(job) {
    const claimed = await this.db.claimJob(job.id);
    if (!claimed) return;
    try {
      const payload = claimed.payload ?? {};
      const text = typeof payload.text === "string" ? payload.text : "";
      const pdfBase64 = typeof payload.pdfBase64 === "string" ? payload.pdfBase64 : "";
      const storageBucket = typeof payload.storageBucket === "string" ? payload.storageBucket : "";
      const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : "";
      const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
      if (!text && !pdfBase64 && !(storageBucket && storagePath)) {
        throw new Error(
          "Job payload must include `text`, `pdfBase64`, or (`storageBucket` + `storagePath`)"
        );
      }
      let resolvedPdfBase64 = pdfBase64;
      let resolvedMimeType = mimeType || "application/pdf";
      if (!text && !resolvedPdfBase64 && storageBucket && storagePath) {
        const buf = await this.db.downloadFromStorage(storageBucket, storagePath);
        resolvedPdfBase64 = buf.toString("base64");
        resolvedMimeType = mimeType || "application/pdf";
      }
      const questions = await this.llm.generateQuestions(
        text ? { kind: "text", text } : { kind: "pdfBase64", base64: resolvedPdfBase64, mimeType: resolvedMimeType }
      );
      if (!questions.length) {
        throw new Error(
          "No valid questions were produced (notes + reduce empty and direct PDF generation returned nothing). Check Gemini output / PDF content."
        );
      }
      const courseIdNum = payload.courseId != null && payload.courseId !== "" ? Number(payload.courseId) : NaN;
      const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
      let materialIdNum;
      if (Number.isFinite(courseIdNum) && storagePath && fileName && !payload.materialId) {
        try {
          const topicSeed = fileName.replace(/\.pdf$/i, "").trim() || fileName;
          materialIdNum = await this.db.insertLearningMaterialDraft({
            courseId: courseIdNum,
            fileName,
            filePath: storagePath,
            topicName: topicSeed
          });
        } catch (e) {
          console.error("[worker] insertLearningMaterialDraft failed:", e);
        }
      }
      const finalMaterialId = payload.materialId != null && payload.materialId !== "" ? Number(payload.materialId) : materialIdNum;
      if (Number.isFinite(courseIdNum) && finalMaterialId && Number.isFinite(finalMaterialId)) {
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
    } catch (err) {
      await this.db.markFailed(claimed.id, String(err?.message || err));
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
  const llm = new GeminiAdapter({
    apiKey: getEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
    minDelayMs: numEnv("GEMINI_MIN_DELAY_MS", 200),
    maxRetries: numEnv("GEMINI_MAX_RETRIES", 5)
  });
  const useCase = new ProcessQuizUseCase(db, llm);
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