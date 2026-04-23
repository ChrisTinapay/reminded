import type { CourseId, MaterialId, UserId } from "../../domain/shared/types";

export interface DashboardProfile {
  id: UserId;
  fullName: string | null;
  email: string | null;
}

export interface DashboardRetentionDue {
  learning: number;
  familiar: number;
  mastered: number;
}

export interface DashboardCourse {
  id: CourseId;
  name: string;
  studentId: UserId;
  topicCount: number;
  createdAt: string;
  /** Counts by `question_state` among rows due today (null or next_review_date <= today). */
  retentionDue: DashboardRetentionDue;
}

export interface DashboardScheduleEntry {
  date: string;
  courseId: CourseId;
  courseName: string;
  materialId: MaterialId | null;
  topicName: string;
  questionCount: number;
}

export interface DashboardGlobalDueByCourse {
  courseId: CourseId;
  courseName: string;
  count: number;
}

export interface DashboardSnapshot {
  profile: DashboardProfile | null;
  courses: DashboardCourse[];
  schedule: DashboardScheduleEntry[];
  globalDueByCourse: DashboardGlobalDueByCourse[];
}

export interface DashboardReadModel {
  getDashboardSnapshot(userId: UserId, today: string): Promise<DashboardSnapshot>;
}

