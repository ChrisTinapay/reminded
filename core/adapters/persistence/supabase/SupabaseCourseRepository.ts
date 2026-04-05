import type {
  CoursePageData,
  CourseRecord,
  CourseRepository,
} from "../../../ports/persistence/CourseRepository";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseCourseRepository implements CourseRepository {
  async createCourse(name: string, studentId: string): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("courses")
      .insert({ course_name: name, user_id: studentId })
      .select("id")
      .single();
    if (error) throw error;
    return String((data as any).id);
  }

  async updateCourseName(courseId: string, newName: string, studentId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("courses")
      .update({ course_name: newName })
      .eq("id", Number(courseId))
      .eq("user_id", studentId);
    if (error) throw error;
  }

  async getCourseDetails(courseId: string): Promise<CourseRecord | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("courses")
      .select("id,course_name,user_id,created_at")
      .eq("id", Number(courseId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: String((data as any).id),
      name: (data as any).course_name,
      studentId: (data as any).user_id,
      createdAt: (data as any).created_at,
    };
  }

  async getCoursePageData(courseId: string, userId: string, today: string): Promise<CoursePageData | null> {
    const supabase = createAdminClient();

    const [courseRes, materialsRes, totalRes, dueRes, newRes, masteredRes, topicDueRes, topicNewRes] =
      await Promise.all([
        supabase.from("courses").select("id,course_name,user_id,created_at").eq("id", Number(courseId)).maybeSingle(),
        supabase
          .from("learning_materials")
          .select("id,course_id,file_name,file_path,topic_name,created_at, questions(count)")
          .eq("course_id", Number(courseId))
          .order("created_at", { ascending: false }),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("course_id", Number(courseId)),
        supabase
          .from("student_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("course_id", Number(courseId))
          .lte("next_review_date", today),
        supabase.rpc("count_new_questions_for_course", { p_user_id: userId, p_course_id: Number(courseId) }),
        supabase
          .from("student_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("course_id", Number(courseId))
          .gte("interval", 21),
        supabase.rpc("topic_due_counts", { p_user_id: userId, p_course_id: Number(courseId), p_today: today }),
        supabase.rpc("topic_new_counts", { p_user_id: userId, p_course_id: Number(courseId) }),
      ]);

    if (courseRes.error) throw courseRes.error;
    if (!courseRes.data) return null;

    if (materialsRes.error) throw materialsRes.error;
    if (totalRes.error) throw totalRes.error;
    if (dueRes.error) throw dueRes.error;
    if (newRes.error) throw newRes.error;
    if (masteredRes.error) throw masteredRes.error;
    if (topicDueRes.error) throw topicDueRes.error;
    if (topicNewRes.error) throw topicNewRes.error;

    const course = {
      id: String((courseRes.data as any).id),
      name: (courseRes.data as any).course_name,
      studentId: (courseRes.data as any).user_id,
      createdAt: (courseRes.data as any).created_at,
    };

    const materials = (materialsRes.data ?? []).map((r: any) => ({
      id: String(r.id),
      courseId: String(r.course_id),
      fileName: r.file_name,
      filePath: r.file_path,
      topicName: r.topic_name || r.file_name,
      questionCount: Number(r.questions?.[0]?.count ?? 0),
      createdAt: r.created_at,
    }));

    const totalQuestions = Number((totalRes as any).count ?? 0);
    const dueQuestions = Number((dueRes as any).count ?? 0);
    const newQuestions = Number((newRes.data as any)?.count ?? 0);
    const masteredQuestions = Number((masteredRes as any).count ?? 0);

    const topicDueCounts: Record<string, number> = {};
    for (const r of (topicDueRes.data ?? []) as any[]) {
      const key = String(r.material_id);
      topicDueCounts[key] = (topicDueCounts[key] || 0) + Number(r.count);
    }
    for (const r of (topicNewRes.data ?? []) as any[]) {
      const key = String(r.material_id);
      topicDueCounts[key] = (topicDueCounts[key] || 0) + Number(r.count);
    }

    return {
      course,
      materials,
      stats: {
        totalQuestions,
        dueQuestions,
        newQuestions,
        masteredQuestions,
      },
      topicDueCounts,
    };
  }
}

