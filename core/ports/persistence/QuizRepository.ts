import type {
  CourseId,
  MaterialId,
  QuestionId,
  Timestamp,
  UserId,
} from "../../domain/shared/types";

export interface DueQuestion {
  id: QuestionId;
  courseId: CourseId;
  materialId: MaterialId | null;
  questionText: string;
  choices: string[];
  correctAnswer: string;
  courseName?: string;
  topicName?: string;
}

export interface StudentProgressState {
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export interface ReviewOutcome {
  questionId: QuestionId;
  userId: UserId;
  wasCorrect: boolean;
  responseTimeMs: number;
  reviewedAt: Timestamp;
}

export interface QuizRepository {
  getDueQuestionsForUser(input: {
    userId: UserId;
    courseId: CourseId;
    materialId?: MaterialId | null;
    today: string;
    limit: number;
  }): Promise<DueQuestion[]>;

  getNewQuestionsForUser(input: {
    userId: UserId;
    courseId: CourseId;
    materialId?: MaterialId | null;
    limit: number;
  }): Promise<DueQuestion[]>;

  getGlobalDueQuestionsForUser(input: {
    userId: UserId;
    today: string;
    limit: number;
  }): Promise<DueQuestion[]>;

  getGlobalNewQuestionsForUser(input: {
    userId: UserId;
    limit: number;
  }): Promise<DueQuestion[]>;

  getProgressState(
    userId: UserId,
    questionId: QuestionId,
  ): Promise<StudentProgressState | null>;

  upsertProgress(input: {
    userId: UserId;
    courseId: CourseId;
    questionId: QuestionId;
    interval: number;
    easeFactor: number;
    repetitions: number;
    nextReviewDate: string;
  }): Promise<void>;

  saveReviewOutcome(outcome: ReviewOutcome): Promise<void>;
}

