import type {
  QuestionRecord,
  QuestionRepository,
} from "../../../ports/persistence/QuestionRepository";
import type { MaterialId, QuestionId } from "../../../domain/shared/types";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseQuestionRepository implements QuestionRepository {
  async saveQuestion(question: Omit<QuestionRecord, "id">): Promise<QuestionId> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .insert({
        course_id: Number(question.courseId),
        material_id: question.materialId ? Number(question.materialId) : null,
        question_text: question.text,
        choices: question.choices,
        correct_answer: question.correctAnswer,
      })
      .select("id")
      .single();
    if (error) throw error;
    return String((data as any).id);
  }

  async updateQuestion(question: QuestionRecord): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("questions")
      .update({
        question_text: question.text,
        choices: question.choices,
        correct_answer: question.correctAnswer,
      })
      .eq("id", Number(question.id));
    if (error) throw error;
  }

  async deleteQuestion(id: QuestionId): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("questions").delete().eq("id", Number(id));
    if (error) throw error;
  }

  async getQuestionsByCourse(courseId: string): Promise<QuestionRecord[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .select("id,course_id,material_id,question_text,choices,correct_answer")
      .eq("course_id", Number(courseId))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      courseId: String(row.course_id),
      materialId: row.material_id == null ? null : String(row.material_id),
      text: row.question_text,
      choices: Array.isArray(row.choices) ? row.choices : [],
      correctAnswer: row.correct_answer,
    }));
  }

  async getQuestionsByMaterial(materialId: MaterialId): Promise<QuestionRecord[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .select("id,course_id,material_id,question_text,choices,correct_answer")
      .eq("material_id", Number(materialId))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      courseId: String(row.course_id),
      materialId: row.material_id == null ? null : String(row.material_id),
      text: row.question_text,
      choices: Array.isArray(row.choices) ? row.choices : [],
      correctAnswer: row.correct_answer,
    }));
  }
}

