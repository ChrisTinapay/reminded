import type { AuthContextPort } from "../../ports/auth/AuthContextPort";
import type { CourseRepository } from "../../ports/persistence/CourseRepository";
import type { LearningMaterialRepository } from "../../ports/persistence/LearningMaterialRepository";
import type { MaterialStoragePort } from "../../ports/storage/MaterialStoragePort";
import { createAdminClient } from "@/utils/supabase/admin";

function isPostgresFkViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "23503" || String(e?.message ?? "").toLowerCase().includes("foreign key");
}

/** Ensures a row exists so `courses.user_id -> profiles.id` can succeed after OAuth without student-setup. */
async function ensureProfileRowExists(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error: selErr } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (selErr) throw selErr;
  if (data) return;
  const safeEmail =
    (email && String(email).trim()) || `pending-${userId}@profile.placeholder`;
  const { error: insErr } = await supabase.from("profiles").insert({
    id: userId,
    full_name: "Student",
    email: safeEmail,
  });
  if (insErr && (insErr as { code?: string }).code !== "23505") throw insErr;
}

export class CourseService {
  constructor(
    private readonly auth: AuthContextPort,
    private readonly courses: CourseRepository,
    private readonly materials: LearningMaterialRepository,
    private readonly storage: MaterialStoragePort,
  ) {}

  async createCourse(courseData: any) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized — please sign in again." };

    const { course_name, student_id } = courseData ?? {};
    if (!course_name || !String(course_name).trim()) {
      return { success: false, error: "Course name is required." };
    }
    const finalStudentId = student_id || user.id;

    try {
      await ensureProfileRowExists(finalStudentId, user.email);
      const id = await this.courses.createCourse(String(course_name).trim(), finalStudentId);
      return { success: true, id };
    } catch (err: unknown) {
      console.error("createCourse failed:", err);
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to create course.";
      if (isPostgresFkViolation(err)) {
        return {
          success: false,
          error:
            "Your account profile is not linked in the database yet. Complete student setup, then try again.",
        };
      }
      return { success: false, error: msg };
    }
  }

  async updateCourseName(courseId: string, newName: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    await this.courses.updateCourseName(String(courseId), String(newName).trim(), user.id);
    return { success: true };
  }

  async fetchCourseDetails(courseId: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return null;
    const course = await this.courses.getCourseDetails(String(courseId));
    if (!course) return null;

    // Keep existing return shape used by UI
    return {
      id: course.id,
      course_name: course.name,
      educator_id: course.studentId,
      created_at: course.createdAt,
      profiles: { full_name: "Instructor" },
      academic_levels: { name: "All Levels" },
      programs: { name: "General" },
    };
  }

  async fetchCoursePageData(courseId: string, clientToday: string | null) {
    const user = await this.auth.getCurrentUser();
    if (!user) return null;
    const today = clientToday || new Date().toISOString().substring(0, 10);
    const data = await this.courses.getCoursePageData(String(courseId), user.id, today);
    if (!data) return null;

    return {
      course: {
        id: data.course.id,
        course_name: data.course.name,
        student_id: data.course.studentId,
        created_at: data.course.createdAt,
      },
      materials: data.materials.map((m) => ({
        id: m.id,
        course_id: m.courseId,
        file_name: m.fileName,
        file_path: m.filePath,
        topic_name: m.topicName,
        question_count: m.questionCount,
        created_at: m.createdAt,
      })),
      stats: {
        total: data.stats.totalQuestions,
        mastered: data.stats.masteredQuestions,
        due: data.stats.dueQuestions + data.stats.newQuestions,
      },
      topicDue: data.topicDueCounts,
    };
  }

  async saveLearningMaterial(input: any) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    const id = await this.materials.saveLearningMaterial({
      courseId: String(input.course_id),
      fileName: String(input.file_name),
      filePath: String(input.file_path),
      topicName: input.topic_name ?? null,
    });
    return { success: true, id };
  }

  async fetchLearningMaterials(courseId: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return [];
    const rows = await this.materials.fetchLearningMaterials(String(courseId));
    return rows.map((row) => ({
      id: row.id,
      course_id: row.courseId,
      file_name: row.fileName,
      file_path: row.filePath,
      topic_name: row.topicName,
      question_count: row.questionCount,
      created_at: row.createdAt,
    }));
  }

  async updateTopicName(materialId: string, newName: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    await this.materials.updateTopicName(String(materialId), String(newName).trim());
    return { success: true };
  }

  async checkTopicHasProgress(materialId: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return false;
    return await this.materials.hasAnyProgress(String(materialId), user.id);
  }

  async deleteLearningMaterial(materialId: string) {
    const user = await this.auth.getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { filePath } = await this.materials.deleteLearningMaterial(String(materialId));
    if (!filePath) return { success: false, error: "Material not found." };

    try {
      await this.storage.removeMaterial(filePath);
    } catch (err) {
      console.error("Warning: Failed to delete from storage:", err);
    }

    return { success: true };
  }
}

