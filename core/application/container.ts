import type { AuthContextPort } from "../ports/auth/AuthContextPort";
import type { QuizRepository } from "../ports/persistence/QuizRepository";
import { SpacedRepetitionService } from "../domain/spacedRepetition/SpacedRepetitionService";
import type { QuestionRepository } from "../ports/persistence/QuestionRepository";
import { QuestionService } from "./questions/QuestionService";
import type { CourseRepository } from "../ports/persistence/CourseRepository";
import type { LearningMaterialRepository } from "../ports/persistence/LearningMaterialRepository";
import type { MaterialStoragePort } from "../ports/storage/MaterialStoragePort";
import { CourseService } from "./courses/CourseService";
import { ProfileService } from "./profiles/ProfileService";
import type { DashboardReadModel } from "../ports/persistence/DashboardReadModel";
import { DashboardService } from "./dashboard/DashboardService";

export interface ApplicationContext {
  auth: AuthContextPort;
  quizRepository?: QuizRepository;
  questionRepository?: QuestionRepository;
  courseRepository?: CourseRepository;
  learningMaterialRepository?: LearningMaterialRepository;
  materialStorage?: MaterialStoragePort;
  dashboardReadModel?: DashboardReadModel;
}

export function createSpacedRepetitionService(ctx: ApplicationContext) {
  if (!ctx.quizRepository) throw new Error("QuizRepository not configured");
  return new SpacedRepetitionService(ctx.quizRepository);
}

export function createApplicationContext(input: {
  auth: AuthContextPort;
  quizRepository?: QuizRepository;
  questionRepository?: QuestionRepository;
  courseRepository?: CourseRepository;
  learningMaterialRepository?: LearningMaterialRepository;
  materialStorage?: MaterialStoragePort;
  dashboardReadModel?: DashboardReadModel;
}): ApplicationContext {
  return {
    auth: input.auth,
    quizRepository: input.quizRepository,
    questionRepository: input.questionRepository,
    courseRepository: input.courseRepository,
    learningMaterialRepository: input.learningMaterialRepository,
    materialStorage: input.materialStorage,
    dashboardReadModel: input.dashboardReadModel,
  };
}

export function createQuestionService(ctx: ApplicationContext) {
  if (!ctx.questionRepository) throw new Error("QuestionRepository not configured");
  return new QuestionService(ctx.auth, ctx.questionRepository);
}

export function createCourseService(ctx: ApplicationContext) {
  if (!ctx.courseRepository) throw new Error("CourseRepository not configured");
  if (!ctx.learningMaterialRepository) throw new Error("LearningMaterialRepository not configured");
  if (!ctx.materialStorage) throw new Error("MaterialStorage not configured");
  return new CourseService(
    ctx.auth,
    ctx.courseRepository,
    ctx.learningMaterialRepository,
    ctx.materialStorage,
  );
}

export function createProfileService(ctx: ApplicationContext) {
  return new ProfileService(ctx.auth);
}

export function createDashboardService(ctx: ApplicationContext) {
  if (!ctx.dashboardReadModel) throw new Error("DashboardReadModel not configured");
  return new DashboardService(ctx.auth, ctx.dashboardReadModel);
}


