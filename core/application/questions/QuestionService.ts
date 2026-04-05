import type { AuthContextPort } from "../../ports/auth/AuthContextPort";
import type {
  QuestionRecord,
  QuestionRepository,
} from "../../ports/persistence/QuestionRepository";

export class QuestionService {
  constructor(
    private readonly auth: AuthContextPort,
    private readonly questions: QuestionRepository,
  ) {}

  private shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async saveQuestion(input: {
    course_id: string;
    material_id?: string | null;
    question_text: string;
    choices: string[];
    correct_answer: string;
    bloom_level?: string | null;
  }): Promise<{ success: true; id: string } | { success: false; error: string }> {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized — please sign in again." };

    const id = await this.questions.saveQuestion({
      courseId: input.course_id,
      materialId: input.material_id ?? null,
      text: input.question_text,
      choices: this.shuffle(input.choices),
      correctAnswer: input.correct_answer,
      bloomLevel: input.bloom_level ?? null,
    });

    return { success: true, id };
  }

  async fetchQuestions(courseId: string): Promise<any[]> {
    const user = await this.auth.getCurrentUser();
    if (!user) return [];

    const rows = await this.questions.getQuestionsByCourse(courseId);
    return rows.map((row) => ({
      id: row.id,
      material_id: row.materialId,
      question_text: row.text,
      choices: row.choices.map((c) => (typeof c === "string" ? c.trim() : c)),
      correct_answer: typeof row.correctAnswer === "string" ? row.correctAnswer.trim() : row.correctAnswer,
      bloom_level: row.bloomLevel ?? null,
    }));
  }

  async fetchQuestionsByMaterial(materialId: string): Promise<any[]> {
    const user = await this.auth.getCurrentUser();
    if (!user) return [];
    const rows = await this.questions.getQuestionsByMaterial(materialId);
    return rows.map((row) => ({
      id: row.id,
      material_id: row.materialId,
      question_text: row.text,
      choices: row.choices.map((c) => (typeof c === "string" ? c.trim() : c)),
      correct_answer: typeof row.correctAnswer === "string" ? row.correctAnswer.trim() : row.correctAnswer,
      bloom_level: row.bloomLevel ?? null,
    }));
  }

  async updateQuestion(questionToSave: any): Promise<{ success: boolean; error?: string }> {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const question: QuestionRecord = {
      id: String(questionToSave.id),
      courseId: String(questionToSave.course_id ?? questionToSave.courseId ?? ""),
      materialId: questionToSave.material_id == null ? null : String(questionToSave.material_id),
      text: String(questionToSave.question_text),
      choices: Array.isArray(questionToSave.choices) ? questionToSave.choices : [],
      correctAnswer: String(questionToSave.correct_answer),
      bloomLevel: questionToSave.bloom_level ?? null,
    };

    await this.questions.updateQuestion(question);
    return { success: true };
  }

  async deleteQuestion(questionId: string): Promise<{ success: boolean; error?: string }> {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    await this.questions.deleteQuestion(String(questionId));
    return { success: true };
  }
}

