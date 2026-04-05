import type {
  LearningMaterialRecord,
  LearningMaterialRepository,
} from "../../../ports/persistence/LearningMaterialRepository";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseLearningMaterialRepository implements LearningMaterialRepository {
  async saveLearningMaterial(input: {
    courseId: string;
    fileName: string;
    filePath: string;
    topicName?: string | null;
  }): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("learning_materials")
      .insert({
        course_id: Number(input.courseId),
        file_name: input.fileName,
        file_path: input.filePath,
        topic_name: input.topicName ?? input.fileName,
      })
      .select("id")
      .single();
    if (error) throw error;
    return String((data as any).id);
  }

  async fetchLearningMaterials(courseId: string): Promise<LearningMaterialRecord[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("learning_materials")
      .select("id,course_id,file_name,file_path,topic_name,created_at, questions(count)")
      .eq("course_id", Number(courseId))
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      courseId: String(row.course_id),
      fileName: row.file_name,
      filePath: row.file_path,
      topicName: row.topic_name || row.file_name,
      questionCount: Number(row.questions?.[0]?.count ?? 0),
      createdAt: row.created_at,
    }));
  }

  async updateTopicName(materialId: string, newName: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("learning_materials")
      .update({ topic_name: newName })
      .eq("id", Number(materialId));
    if (error) throw error;
  }

  async hasAnyProgress(materialId: string, userId: string): Promise<boolean> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("topic_has_progress", {
      p_material_id: Number(materialId),
      p_user_id: userId,
    });
    if (error) throw error;
    return Boolean((data as any)?.has_progress);
  }

  async deleteLearningMaterial(materialId: string): Promise<{ filePath: string | null }> {
    const supabase = createAdminClient();
    const { data: material, error: matErr } = await supabase
      .from("learning_materials")
      .select("file_path")
      .eq("id", Number(materialId))
      .maybeSingle();
    if (matErr) throw matErr;
    if (!material) return { filePath: null };

    // Delete questions first (to match current behavior)
    const { error: qErr } = await supabase.from("questions").delete().eq("material_id", Number(materialId));
    if (qErr) throw qErr;

    const { error: delErr } = await supabase.from("learning_materials").delete().eq("id", Number(materialId));
    if (delErr) throw delErr;

    return { filePath: (material as any).file_path ?? null };
  }
}

