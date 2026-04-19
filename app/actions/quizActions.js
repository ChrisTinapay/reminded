'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext'
import { SupabaseQuizRepository } from '@core/adapters/persistence/supabase/SupabaseQuizRepository'
import { createApplicationContext, createSpacedRepetitionService } from '@core/application/container'

// Helper: Fisher-Yates shuffle for randomizing choices
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createQuizModule() {
  const auth = new SupabaseAuthContext()
  const quizRepository = new SupabaseQuizRepository()
  const ctx = createApplicationContext({ auth, quizRepository })
  const spacedRepetitionService = createSpacedRepetitionService(ctx)
  return { auth, quizRepository, spacedRepetitionService }
}

// 1. Fetch Questions (optionally filtered by materialId for topic-specific sessions)
export async function getDueQuestions(courseId, materialId = null, clientToday = null) {
  const { auth, quizRepository } = createQuizModule()
  const user = await auth.getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const today = clientToday || new Date().toISOString().substring(0, 10)
  const BATCH_SIZE = 20;

  try {
    const due = await quizRepository.getDueQuestionsForUser({
      userId: user.id,
      courseId: String(courseId),
      materialId: materialId ? String(materialId) : null,
      today,
      limit: BATCH_SIZE,
    })

    let questions = due.map(q => ({
      id: q.id,
      course_id: q.courseId,
      material_id: q.materialId,
      question_text: q.questionText,
      choices: shuffleArray(q.choices),
      correct_answer: q.correctAnswer,
      _is_new: false,
    }))

    if (questions.length < BATCH_SIZE) {
      const more = await quizRepository.getNewQuestionsForUser({
        userId: user.id,
        courseId: String(courseId),
        materialId: materialId ? String(materialId) : null,
        limit: BATCH_SIZE - questions.length,
      })
      const newQuestions = more.map(q => ({
        id: q.id,
        course_id: q.courseId,
        material_id: q.materialId,
        question_text: q.questionText,
        choices: shuffleArray(q.choices),
        correct_answer: q.correctAnswer,
        _is_new: true,
      }))
      questions = [...questions, ...newQuestions]
    }

    return { questions: questions.sort(() => Math.random() - 0.5) }
  } catch (err) {
    console.error("Error Fetching Turso Questions:", err);
    return { error: 'Failed to fetch' }
  }
}

// 1b. Fetch Due Questions Globally (across ALL courses for Master Study button)
export async function getGlobalDueQuestions(clientToday = null) {
  const { auth, quizRepository } = createQuizModule()
  const user = await auth.getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const today = clientToday || new Date().toISOString().substring(0, 10)
  const BATCH_SIZE = 20;

  try {
    const due = await quizRepository.getGlobalDueQuestionsForUser({
      userId: user.id,
      today,
      limit: BATCH_SIZE,
    })

    let questions = due.map(q => ({
      id: q.id,
      course_id: q.courseId,
      material_id: q.materialId,
      question_text: q.questionText,
      choices: shuffleArray(q.choices),
      correct_answer: q.correctAnswer,
      course_name: q.courseName,
      topic_name: q.topicName,
      _is_new: false,
    }))

    if (questions.length < BATCH_SIZE) {
      const more = await quizRepository.getGlobalNewQuestionsForUser({
        userId: user.id,
        limit: BATCH_SIZE - questions.length,
      })
      const newQuestions = more.map(q => ({
        id: q.id,
        course_id: q.courseId,
        material_id: q.materialId,
        question_text: q.questionText,
        choices: shuffleArray(q.choices),
        correct_answer: q.correctAnswer,
        course_name: q.courseName,
        topic_name: q.topicName,
        _is_new: true,
      }))
      questions = [...questions, ...newQuestions]
    }

    return { questions: questions.sort(() => Math.random() - 0.5) }
  } catch (err) {
    console.error("Error Fetching Global Due Questions:", err);
    return { error: 'Failed to fetch' }
  }
}


// 2. Save Result (SM-2 + immutable telemetry log)
// Payload: { courseId, questionId, isCorrect, responseLatency, clientToday? }
export async function submitQuizResult(payload) {
  const courseId = payload?.courseId
  const questionId = payload?.questionId
  const isCorrect = payload?.isCorrect
  const responseLatency = payload?.responseLatency
  const clientToday = payload?.clientToday ?? null

  try {
    const { auth, spacedRepetitionService } = createQuizModule()
    const user = await auth.getCurrentUser()
    if (!user) {
      console.error("Save Failed: No User Logged In")
      return
    }

    await spacedRepetitionService.submitReview({
      userId: user.id,
      courseId: String(courseId),
      questionId: String(questionId),
      isCorrect: Boolean(isCorrect),
      responseLatencySeconds: Number(responseLatency),
      clientToday,
    })

  } catch (err) {
    console.error("CRITICAL: Database Save Error:", err)
  }

  revalidatePath(`/dashboard/student/course/${courseId}`)
  revalidatePath('/dashboard/student')
}