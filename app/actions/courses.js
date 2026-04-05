'use server';

import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext';
import { SupabaseCourseRepository } from '@core/adapters/persistence/supabase/SupabaseCourseRepository';
import { SupabaseLearningMaterialRepository } from '@core/adapters/persistence/supabase/SupabaseLearningMaterialRepository';
import { SupabaseMaterialStorageAdapter } from '@core/adapters/storage/SupabaseMaterialStorageAdapter';
import { createApplicationContext, createCourseService } from '@core/application/container';

function createCoursesModule() {
    const auth = new SupabaseAuthContext();
    const courseRepository = new SupabaseCourseRepository();
    const learningMaterialRepository = new SupabaseLearningMaterialRepository();
    const materialStorage = new SupabaseMaterialStorageAdapter();
    const ctx = createApplicationContext({
        auth,
        courseRepository,
        learningMaterialRepository,
        materialStorage,
    });
    const courseService = createCourseService(ctx);
    return { courseService };
}

export async function createCourse(courseData) {
    const { courseService } = createCoursesModule();
    return await courseService.createCourse(courseData);
}

export async function updateCourseName(courseId, newName) {
    const { courseService } = createCoursesModule();
    return await courseService.updateCourseName(courseId, newName);
}

export async function fetchCourseDetails(courseId) {
    const { courseService } = createCoursesModule();
    return await courseService.fetchCourseDetails(courseId);
}

// Combined fetch for course page — single auth check, single DB connection
export async function fetchCoursePageData(courseId, clientToday = null) {
    const { courseService } = createCoursesModule();
    return await courseService.fetchCoursePageData(courseId, clientToday);
}


export async function saveLearningMaterial({ course_id, file_name, file_path, topic_name }) {
    const { courseService } = createCoursesModule();
    return await courseService.saveLearningMaterial({ course_id, file_name, file_path, topic_name });
}

export async function fetchLearningMaterials(courseId) {
    const { courseService } = createCoursesModule();
    return await courseService.fetchLearningMaterials(courseId);
}

export async function updateTopicName(materialId, newName) {
    const { courseService } = createCoursesModule();
    return await courseService.updateTopicName(materialId, newName);
}

export async function checkTopicHasProgress(materialId) {
    const { courseService } = createCoursesModule();
    return await courseService.checkTopicHasProgress(materialId);
}

export async function deleteLearningMaterial(materialId) {
    const { courseService } = createCoursesModule();
    return await courseService.deleteLearningMaterial(materialId);
}
