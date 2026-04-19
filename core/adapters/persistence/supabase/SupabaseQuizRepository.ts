import type {
  DueQuestion,
  QuizRepository,
  PersistReviewTransactionInput,
  StudentProgressState,
} from "../../../ports/persistence/QuizRepository";
import type { CourseId, MaterialId, QuestionId, UserId } from "../../../domain/shared/types";
import { createAdminClient } from "@/utils/supabase/admin";

function normalizeChoices(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class SupabaseQuizRepository implements QuizRepository {
  async getDueQuestionsForUser(input: {
    userId: UserId;
    courseId: CourseId;
    materialId?: MaterialId | null;
    today: string;
    limit: number;
  }): Promise<DueQuestion[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_due_questions", {
      p_user_id: input.userId,
      p_course_id: Number(input.courseId),
      p_material_id: input.materialId ? Number(input.materialId) : null,
      p_today: input.today,
      p_limit: input.limit,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id) as QuestionId,
      courseId: String(row.course_id) as CourseId,
      materialId: row.material_id == null ? null : (String(row.material_id) as MaterialId),
      questionText: row.question_text,
      choices: normalizeChoices(row.choices),
      correctAnswer: row.correct_answer,
    }));
  }

  async getNewQuestionsForUser(input: {
    userId: UserId;
    courseId: CourseId;
    materialId?: MaterialId | null;
    limit: number;
  }): Promise<DueQuestion[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_new_questions", {
      p_user_id: input.userId,
      p_course_id: Number(input.courseId),
      p_material_id: input.materialId ? Number(input.materialId) : null,
      p_limit: input.limit,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id) as QuestionId,
      courseId: String(row.course_id) as CourseId,
      materialId: row.material_id == null ? null : (String(row.material_id) as MaterialId),
      questionText: row.question_text,
      choices: normalizeChoices(row.choices),
      correctAnswer: row.correct_answer,
    }));
  }

  async getGlobalDueQuestionsForUser(input: {
    userId: UserId;
    today: string;
    limit: number;
  }): Promise<DueQuestion[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_global_due_questions", {
      p_user_id: input.userId,
      p_today: input.today,
      p_limit: input.limit,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id) as QuestionId,
      courseId: String(row.course_id) as CourseId,
      materialId: row.material_id == null ? null : (String(row.material_id) as MaterialId),
      questionText: row.question_text,
      choices: normalizeChoices(row.choices),
      correctAnswer: row.correct_answer,
      courseName: row.course_name ?? undefined,
      topicName: row.topic_name ?? undefined,
    }));
  }

  async getGlobalNewQuestionsForUser(input: {
    userId: UserId;
    limit: number;
  }): Promise<DueQuestion[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_global_new_questions", {
      p_user_id: input.userId,
      p_limit: input.limit,
    });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id) as QuestionId,
      courseId: String(row.course_id) as CourseId,
      materialId: row.material_id == null ? null : (String(row.material_id) as MaterialId),
      questionText: row.question_text,
      choices: normalizeChoices(row.choices),
      correctAnswer: row.correct_answer,
      courseName: row.course_name ?? undefined,
      topicName: row.topic_name ?? undefined,
    }));
  }

  async getProgressState(userId: UserId, questionId: QuestionId): Promise<StudentProgressState | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("student_progress")
      .select("interval,ease_factor,repetition_n")
      .eq("user_id", userId)
      .eq("question_id", Number(questionId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const interval = Number((data as any).interval ?? 0);
    const easeFactor = Number((data as any).ease_factor ?? 2.5);
    const repetitions = Number((data as any).repetition_n ?? 0);

    return { interval, easeFactor, repetitions };
  }

  async persistReviewTransaction(input: PersistReviewTransactionInput): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("apply_review_with_telemetry", {
      p_user_id: input.userId,
      p_course_id: Number(input.courseId),
      p_question_id: Number(input.questionId),
      p_response_latency: input.responseLatencySeconds,
      p_is_correct: input.isCorrect,
      p_quality_score_q: input.qualityScoreQ,
      p_repetition_n: input.repetitionN,
      p_easiness_factor_ef: input.easinessFactorEf,
      p_next_interval_i: input.nextIntervalI,
      p_next_review_date: input.nextReviewDate,
    });
    if (error) throw error;
  }
}
