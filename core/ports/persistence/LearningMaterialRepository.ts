import type { CourseId, MaterialId, UserId } from "../../domain/shared/types";

export interface LearningMaterialRecord {
  id: MaterialId;
  courseId: CourseId;
  fileName: string;
  filePath: string;
  topicName: string;
  questionCount: number;
  createdAt: string;
}

export interface LearningMaterialRepository {
  saveLearningMaterial(input: {
    courseId: CourseId;
    fileName: string;
    filePath: string;
    topicName?: string | null;
  }): Promise<MaterialId>;

  fetchLearningMaterials(courseId: CourseId): Promise<LearningMaterialRecord[]>;

  updateTopicName(materialId: MaterialId, newName: string): Promise<void>;

  hasAnyProgress(materialId: MaterialId, userId: UserId): Promise<boolean>;

  deleteLearningMaterial(materialId: MaterialId): Promise<{ filePath: string | null }>;
}

