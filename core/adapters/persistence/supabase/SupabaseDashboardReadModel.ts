import type {
  DashboardReadModel,
  DashboardSnapshot,
} from "../../../ports/persistence/DashboardReadModel";
import { createAdminClient } from "@/utils/supabase/admin";

export class SupabaseDashboardReadModel implements DashboardReadModel {
  async getDashboardSnapshot(userId: string, today: string): Promise<DashboardSnapshot> {
    const supabase = createAdminClient();

    const dueOrFilter = `next_review_date.is.null,next_review_date.lte.${today}`;

    const [profileRes, coursesRes, scheduledRes, newRes, dueByCourseRes, dueRetentionRes] = await Promise.all([
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
      supabase
        .from("student_progress")
        .select("course_id,question_state")
        .eq("user_id", userId)
        .or(dueOrFilter),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (coursesRes.error) throw coursesRes.error;
    if (scheduledRes.error) throw scheduledRes.error;
    if (newRes.error) throw newRes.error;
    if (dueByCourseRes.error) throw dueByCourseRes.error;
    if (dueRetentionRes.error) throw dueRetentionRes.error;

    const profile = profileRes.data
      ? {
          id: String((profileRes.data as any).id),
          fullName: (profileRes.data as any).full_name ?? null,
          email: null,
        }
      : null;

    const retentionByCourse = new Map<
      string,
      { learning: number; familiar: number; mastered: number }
    >();
    for (const row of (dueRetentionRes.data ?? []) as any[]) {
      const cid = String(row.course_id);
      const st = String(row.question_state ?? "Familiar");
      if (!retentionByCourse.has(cid)) {
        retentionByCourse.set(cid, { learning: 0, familiar: 0, mastered: 0 });
      }
      const b = retentionByCourse.get(cid)!;
      if (st === "Learning") b.learning += 1;
      else if (st === "Mastered") b.mastered += 1;
      else b.familiar += 1;
    }

    const emptyRetention = { learning: 0, familiar: 0, mastered: 0 };
    const courses = (coursesRes.data ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.course_name,
      studentId: row.user_id,
      topicCount: Number(row.learning_materials?.[0]?.count ?? 0),
      createdAt: row.created_at,
      retentionDue: retentionByCourse.get(String(row.id)) ?? { ...emptyRetention },
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

    const globalDueByCourse = ((dueByCourseRes.data ?? []) as any[]).map((r) => ({
      courseId: String(r.course_id),
      courseName: r.course_name,
      count: Number(r.count),
    }));

    return { profile, courses, schedule, globalDueByCourse };
  }
}

