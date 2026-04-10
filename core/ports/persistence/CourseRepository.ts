import type { CourseId, MaterialId, UserId } from "../../domain/shared/types";

export interface CourseRecord {
  id: CourseId;
  name: string;
  studentId: UserId;
  createdAt: string;
}

export interface LearningMaterialRecord {
  id: MaterialId;
  courseId: CourseId;
  fileName: string;
  filePath: string;
  topicName: string;
  questionCount: number;
  createdAt: string;
}

export interface CourseStats {
  totalQuestions: number;
  dueQuestions: number;
  newQuestions: number;
  masteredQuestions: number;
}

export interface CoursePageData {
  course: CourseRecord;
  materials: LearningMaterialRecord[];
  stats: CourseStats;
  topicDueCounts: Record<MaterialId, number>;
}

export interface CourseRepository {
  createCourse(name: string, studentId: UserId): Promise<CourseId>;
  updateCourseName(courseId: CourseId, newName: string, studentId: UserId): Promise<void>;
  getCourseDetails(courseId: CourseId): Promise<CourseRecord | null>;
  getCoursePageData(courseId: CourseId, userId: UserId, today: string): Promise<CoursePageData | null>;
  deleteCourse(
    courseId: CourseId,
    studentId: UserId,
  ): Promise<{ deleted: boolean; filePaths: string[] }>;
}

