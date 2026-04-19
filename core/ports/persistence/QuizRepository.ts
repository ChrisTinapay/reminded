import type {
  CourseId,
  MaterialId,
  QuestionId,
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
  retentionState?: string;
}

export interface StudentProgressState {
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export interface PersistReviewTransactionInput {
  userId: UserId;
  courseId: CourseId;
  questionId: QuestionId;
  responseLatencySeconds: number;
  isCorrect: boolean;
  qualityScoreQ: number;
  repetitionN: number;
  easinessFactorEf: number;
  nextIntervalI: number;
  nextReviewDate: string;
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

  persistReviewTransaction(input: PersistReviewTransactionInput): Promise<void>;
}

