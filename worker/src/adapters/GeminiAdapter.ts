import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ILLMService, LLMJobInput, QuestionDraft } from "../ports/ILLMService";
import { chunkText } from "../domain/chunking";
import { mapPromptForChunk, reducePromptForQuestions } from "../domain/prompts";
import { distributeAnswerPositions, normalizeQuestions } from "../domain/validation";

type GeminiAdapterOpts = {
  apiKey: string;
  minDelayMs: number;
  maxRetries: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitError(err: unknown): boolean {
  const msg = String((err as any)?.message || err);
  return msg.includes("429") || msg.toLowerCase().includes("rate");
}

export class GeminiAdapter implements ILLMService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly minDelayMs: number;
  private readonly maxRetries: number;
  private lastCallAt = 0;

  constructor(opts: GeminiAdapterOpts) {
    this.genAI = new GoogleGenerativeAI(opts.apiKey);
    this.minDelayMs = Math.max(0, opts.minDelayMs);
    this.maxRetries = Math.max(0, opts.maxRetries);
  }

  async mapChunkToNotes(prompt: string): Promise<{ notes: string[] }> {
    const json = await this.callJsonWithBackoff(() => this.generateJsonFromText(prompt));
    const notes = Array.isArray((json as any)?.notes) ? (json as any).notes : [];
    return { notes: notes.map((n: any) => String(n).trim()).filter(Boolean) };
  }

  async reduceNotesToQuestions(prompt: string): Promise<QuestionDraft[]> {
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
              bloom_level: { type: SchemaType.STRING },
            },
            required: ["question_text", "choices", "correct_answer", "bloom_level"],
          },
        },
      },
    });

    const json = await this.callJsonWithBackoff(async () => {
      await this.pace();
      const res = await model.generateContent([prompt]);
      return JSON.parse(res.response.text());
    });

    return normalizeQuestions(json);
  }

  async generateQuestions(input: LLMJobInput): Promise<QuestionDraft[]> {
    // Backward-compat: keep prior behavior for any remaining callers.
    const notes = await this.mapReduceNotes(input);
    let questions: QuestionDraft[] = [];
    if (notes.length > 0) {
      questions = await this.reduceNotesToQuestions(reducePromptForQuestions(notes.slice(0, 250)));
    }
    if (questions.length === 0 && input.kind === "pdfBase64" && input.base64?.length > 0) {
      questions = await this.generateQuestionsDirectFromPdf(input);
    }
    return distributeAnswerPositions(questions as any) as any;
  }

  private async mapReduceNotes(input: LLMJobInput): Promise<string[]> {
    // Map stage: produce compact notes per chunk.
    // - Preferred: chunk the provided text.
    // - Fallback: ask Gemini to produce notes from the entire PDF first.
    if (input.kind === "text") {
      const chunks = chunkText(input.text);
      const notes: string[] = [];

      for (const c of chunks) {
        const json = await this.callJsonWithBackoff(() =>
          this.generateJsonFromText(mapPromptForChunk(c)),
        );
        const n = Array.isArray((json as any)?.notes) ? (json as any).notes : [];
        for (const item of n) {
          const s = String(item).trim();
          if (s) notes.push(s);
        }
      }
      return notes;
    }

    // pdfBase64 fallback: get notes first, then reduce to questions.
    const pdfNotesJson = await this.callJsonWithBackoff(() => this.generateNotesFromPdf(input));
    const notes = Array.isArray((pdfNotesJson as any)?.notes) ? (pdfNotesJson as any).notes : [];
    return notes.map((n: any) => String(n).trim()).filter(Boolean);
  }

  // (legacy reduceNotesToQuestions(notes[]) removed; use reduceNotesToQuestions(prompt) instead)

  private async generateJsonFromText(prompt: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    await this.pace();
    const res = await model.generateContent([prompt]);
    return JSON.parse(res.response.text());
  }

  private async generateNotesFromPdf(input: Extract<LLMJobInput, { kind: "pdfBase64" }>) {
    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    await this.pace();
    const res = await model.generateContent([
      {
        inlineData: {
          data: input.base64,
          mimeType: input.mimeType ?? "application/pdf",
        },
      },
      [
        "Extract concise study notes from this PDF.",
        "Return ONLY JSON with schema: { \"notes\": string[] }",
        "Rules:",
        "- Notes must be concise (<= 18 words each)",
        "- Prefer definitions, formulas, rules, key distinctions",
        "- Avoid duplicates",
      ].join("\n"),
    ]);
    return JSON.parse(res.response.text());
  }

  /**
   * When map→reduce yields no notes or no valid questions, generate MCQs in one structured call.
   */
  private async generateQuestionsDirectFromPdf(
    input: Extract<LLMJobInput, { kind: "pdfBase64" }>,
  ): Promise<QuestionDraft[]> {
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
                items: { type: SchemaType.STRING },
              },
              correct_answer: { type: SchemaType.STRING },
              bloom_level: { type: SchemaType.STRING },
            },
            required: ["question_text", "choices", "correct_answer", "bloom_level"],
          },
        },
      },
    });

    const json = await this.callJsonWithBackoff(async () => {
      await this.pace();
      const res = await model.generateContent([
        {
          inlineData: {
            data: input.base64,
            mimeType: input.mimeType ?? "application/pdf",
          },
        },
        `Generate 20 multiple-choice questions based on this document.

CRITICAL CONSTRAINTS:

Brevity: The question stem must be under 20 words. The options must be under 5 words.

Speed: The question must be readable and answerable within 10 seconds.

Bloom's Taxonomy: Create a mix of levels, BUT convert higher-order scenarios into concise formats.

Answer Position: Distribute the correct answer evenly across all positions (A, B, C, D).

Output Format: JSON array only.`,
      ]);
      return JSON.parse(res.response.text());
    });

    return normalizeQuestions(json);
  }

  private async pace() {
    const now = Date.now();
    const elapsed = now - this.lastCallAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastCallAt = Date.now();
  }

  private async callJsonWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    // simple exponential backoff with jitter on 429-like errors
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt > this.maxRetries || !isRateLimitError(err)) throw err;
        const base = Math.min(10_000, 500 * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * 250);
        await sleep(base + jitter);
      }
    }
  }
}

