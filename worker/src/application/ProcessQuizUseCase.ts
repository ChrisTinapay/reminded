import type { IDatabaseService, JobRecord, JobResult } from "../ports/IDatabaseService";
import type { ILLMService } from "../ports/ILLMService";

type QuizJobPayload = {
  /**
   * Prefer providing text to enable strict map-reduce chunking.
   * If missing, you can provide pdfBase64 for a fallback path.
   */
  text?: string;
  pdfBase64?: string;
  storageBucket?: string;
  storagePath?: string;
  mimeType?: string;
  fileName?: string;
  courseId?: number | string;
  materialId?: number | string;
};

export class ProcessQuizUseCase {
  constructor(
    private readonly db: IDatabaseService,
    private readonly llm: ILLMService,
  ) {}

  async processOne(job: JobRecord): Promise<void> {
    const claimed = await this.db.claimJob(job.id);
    if (!claimed) return;

    try {
      const payload = (claimed.payload ?? {}) as QuizJobPayload;
      const text = typeof payload.text === "string" ? payload.text : "";
      const pdfBase64 = typeof payload.pdfBase64 === "string" ? payload.pdfBase64 : "";
      const storageBucket =
        typeof payload.storageBucket === "string" ? payload.storageBucket : "";
      const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : "";
      const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";

      if (!text && !pdfBase64 && !(storageBucket && storagePath)) {
        throw new Error(
          "Job payload must include `text`, `pdfBase64`, or (`storageBucket` + `storagePath`)",
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
        text
          ? { kind: "text", text }
          : { kind: "pdfBase64", base64: resolvedPdfBase64, mimeType: resolvedMimeType as any },
      );

      if (!questions.length) {
        throw new Error(
          "No valid questions were produced (notes + reduce empty and direct PDF generation returned nothing). Check Gemini output / PDF content.",
        );
      }

      const courseIdNum =
        payload.courseId != null && payload.courseId !== ""
          ? Number(payload.courseId)
          : NaN;
      const fileName =
        typeof payload.fileName === "string" ? payload.fileName : "";
      let materialIdNum: number | undefined;
      if (
        Number.isFinite(courseIdNum) &&
        storagePath &&
        fileName &&
        !payload.materialId
      ) {
        try {
          const topicSeed =
            fileName.replace(/\.pdf$/i, "").trim() || fileName;
          materialIdNum = await this.db.insertLearningMaterialDraft({
            courseId: courseIdNum,
            fileName,
            filePath: storagePath,
            topicName: topicSeed,
          });
        } catch (e) {
          // Non-fatal: UI can still create material on publish
          // eslint-disable-next-line no-console
          console.error("[worker] insertLearningMaterialDraft failed:", e);
        }
      }

      const result: JobResult = {
        questions: questions.map((q) => ({
          question_text: q.question_text,
          choices: q.choices,
          correct_answer: q.correct_answer,
          bloom_level: q.bloom_level,
        })),
        meta: {
          courseId: payload.courseId,
          materialId:
            payload.materialId ??
            (materialIdNum != null ? String(materialIdNum) : undefined),
        },
      };

      await this.db.markCompleted(claimed.id, result);
    } catch (err) {
      await this.db.markFailed(claimed.id, String((err as any)?.message || err));
    }
  }
}

