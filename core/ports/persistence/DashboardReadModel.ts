import type { CourseId, MaterialId, UserId } from "../../domain/shared/types";

export interface DashboardProfile {
  id: UserId;
  fullName: string | null;
  email: string | null;
}

export interface DashboardCourse {
  id: CourseId;
  name: string;
  studentId: UserId;
  topicCount: number;
  createdAt: string;
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

