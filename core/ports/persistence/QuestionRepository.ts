import type { CourseId, MaterialId, QuestionId } from "../../domain/shared/types";

export interface QuestionRecord {
  id: QuestionId;
  courseId: CourseId;
  materialId: MaterialId | null;
  text: string;
  choices: string[];
  correctAnswer: string;
  bloomLevel?: string | null;
}

export interface QuestionRepository {
  saveQuestion(question: Omit<QuestionRecord, "id">): Promise<QuestionId>;
  updateQuestion(question: QuestionRecord): Promise<void>;
  deleteQuestion(id: QuestionId): Promise<void>;
  getQuestionsByCourse(courseId: CourseId): Promise<QuestionRecord[]>;
  getQuestionsByMaterial(materialId: MaterialId): Promise<QuestionRecord[]>;
}

