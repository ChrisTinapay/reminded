export type QuestionDraft = {
  question_text: string;
  choices: string[];
  correct_answer: string;
  bloom_level: string;
};

export type LLMJobInput =
  | { kind: "text"; text: string }
  | { kind: "pdfBase64"; base64: string; mimeType?: "application/pdf" };

export interface ILLMService {
  /**
   * Must implement Map-Reduce orchestration internally to bypass token limits.
   */
  generateQuestions(input: LLMJobInput): Promise<QuestionDraft[]>;
}

