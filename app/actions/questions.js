'use server';

import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext';
import { SupabaseQuestionRepository } from '@core/adapters/persistence/supabase/SupabaseQuestionRepository';
import { createApplicationContext, createQuestionService } from '@core/application/container';

function createQuestionsModule() {
    const auth = new SupabaseAuthContext();
    const questionRepository = new SupabaseQuestionRepository();
    const ctx = createApplicationContext({ auth, questionRepository });
    const questionService = createQuestionService(ctx);
    return { questionService };
}

export async function saveQuestion(questionData) {
    const { questionService } = createQuestionsModule();
    return await questionService.saveQuestion(questionData);
}

export async function fetchQuestions(courseId) {
    const { questionService } = createQuestionsModule();
    return await questionService.fetchQuestions(courseId);
}

export async function fetchQuestionsByMaterial(materialId) {
    const { questionService } = createQuestionsModule();
    return await questionService.fetchQuestionsByMaterial(materialId);
}

export async function updateQuestion(questionToSave) {
    const { questionService } = createQuestionsModule();
    return await questionService.updateQuestion(questionToSave);
}

export async function deleteQuestion(questionId) {
    const { questionService } = createQuestionsModule();
    return await questionService.deleteQuestion(questionId);
}
