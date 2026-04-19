import type { AuthContextPort } from "../../ports/auth/AuthContextPort";
import type { DashboardReadModel } from "../../ports/persistence/DashboardReadModel";

export class DashboardService {
  constructor(
    private readonly auth: AuthContextPort,
    private readonly readModel: DashboardReadModel,
  ) {}

  async fetchDashboardData(clientToday: string | null) {
    const user = await this.auth.getCurrentUser();
    if (!user) {
      return { profile: null, courses: [], schedule: {}, globalDue: { total: 0, courses: [] } };
    }

    const today = clientToday || new Date().toISOString().substring(0, 10);
    const snapshot = await this.readModel.getDashboardSnapshot(user.id, today);

    const scheduleMap: Record<string, any[]> = {};
    for (const row of snapshot.schedule) {
      const date = String(row.date).substring(0, 10);
      if (!scheduleMap[date]) scheduleMap[date] = [];
      const existing = scheduleMap[date].find(
        (e) => e.course_id === row.courseId && e.material_id === row.materialId,
      );
      if (existing) existing.question_count += Number(row.questionCount);
      else {
        scheduleMap[date].push({
          course_id: row.courseId,
          course_name: row.courseName,
          material_id: row.materialId,
          topic_name: row.topicName || "Uncategorized",
          question_count: Number(row.questionCount),
        });
      }
    }

    const globalDueCourses = snapshot.globalDueByCourse.map((c) => ({
      course_id: c.courseId,
      course_name: c.courseName,
      count: Number(c.count),
    }));
    const globalDueTotal = globalDueCourses.reduce((sum, c) => sum + c.count, 0);

    return {
      profile: snapshot.profile
        ? {
            id: snapshot.profile.id,
            full_name: snapshot.profile.fullName,
            email: snapshot.profile.email ?? user.email ?? null,
          }
        : null,
      courses: snapshot.courses.map((c) => ({
        id: c.id,
        course_name: c.name,
        student_id: c.studentId,
        topic_count: c.topicCount,
        created_at: c.createdAt,
        retention_due: c.retentionDue,
      })),
      schedule: scheduleMap,
      globalDue: { total: globalDueTotal, courses: globalDueCourses },
    };
  }
}

