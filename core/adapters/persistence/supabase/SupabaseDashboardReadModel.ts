import type {
  DashboardReadModel,
  DashboardSnapshot,
} from "../../../ports/persistence/DashboardReadModel";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseDashboardReadModel implements DashboardReadModel {
  async getDashboardSnapshot(userId: string, today: string): Promise<DashboardSnapshot> {
    const supabase = createAdminClient();

    const [profileRes, coursesRes, scheduledRes, newRes, dueByCourseRes] = await Promise.all([
      // `email` lives on auth.users; many Supabase `profiles` tables omit it.
      supabase.from("profiles").select("id,full_name").eq("id", userId).maybeSingle(),
      supabase
        .from("courses")
        .select("id,course_name,user_id,created_at, learning_materials(count)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.rpc("dashboard_scheduled_counts", { p_user_id: userId }),
      supabase.rpc("dashboard_new_counts", { p_user_id: userId }),
      supabase.rpc("dashboard_due_by_course", { p_user_id: userId, p_today: today }),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (coursesRes.error) throw coursesRes.error;
    if (scheduledRes.error) throw scheduledRes.error;
    if (newRes.error) throw newRes.error;
    if (dueByCourseRes.error) throw dueByCourseRes.error;

    const profile = profileRes.data
      ? {
          id: String((profileRes.data as any).id),
          fullName: (profileRes.data as any).full_name ?? null,
          email: null,
        }
      : null;

    const courses = (coursesRes.data ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.course_name,
      studentId: row.user_id,
      topicCount: Number(row.learning_materials?.[0]?.count ?? 0),
      createdAt: row.created_at,
    }));

    const schedule = [
      ...((scheduledRes.data ?? []) as any[]).map((r) => ({
        date: String(r.date),
        courseId: String(r.course_id),
        courseName: r.course_name,
        materialId: r.material_id == null ? null : String(r.material_id),
        topicName: r.topic_name ?? "Uncategorized",
        questionCount: Number(r.question_count),
      })),
      ...((newRes.data ?? []) as any[]).map((r) => ({
        date: today,
        courseId: String(r.course_id),
        courseName: r.course_name,
        materialId: r.material_id == null ? null : String(r.material_id),
        topicName: r.topic_name ?? "Uncategorized",
        questionCount: Number(r.question_count),
      })),
    ];

    const globalDueByCourse = [
      ...((dueByCourseRes.data ?? []) as any[]).map((r) => ({
        courseId: String(r.course_id),
        courseName: r.course_name,
        count: Number(r.count),
      })),
      // add new questions to due by course
      ...((newRes.data ?? []) as any[]).map((r) => ({
        courseId: String(r.course_id),
        courseName: r.course_name,
        count: Number(r.question_count),
      })),
    ].reduce((acc: any[], row) => {
      const existing = acc.find((x) => x.courseId === row.courseId);
      if (existing) existing.count += row.count;
      else acc.push({ ...row });
      return acc;
    }, []);

    return { profile, courses, schedule, globalDueByCourse };
  }
}

