'use server'

import { createClient } from '@/utils/supabase/server' 
import { revalidatePath } from 'next/cache'

// Helper: Your "Speed-based" Grading Logic
function calculateQuality(isCorrect, timeTakenSeconds) {
  if (!isCorrect) return 0; // Wrong answer is always a failure (0)
  if (timeTakenSeconds <= 5) return 5;  // Instant Recall (Perfect)
  if (timeTakenSeconds <= 12) return 4; // Good pace
  return 3; // Slow/Hesitant but correct
}

// 1. Fetch Questions
export async function getDueQuestions(courseId) {
  console.log("\n!!! SERVER ACTION STARTED (FETCH) !!!")

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    console.log("Auth Error:", authError?.message)
    return { error: 'Unauthorized' }
  }

  const now = new Date().toISOString()
  const BATCH_SIZE = 20; // UPDATED: Changed from 10/15 to 20

  // A. Fetch items due for review
  const { data: dueItems, error: dueError } = await supabase
    .from('student_progress')
    .select('question_id, questions(*)')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .lte('next_review_date', now)
    .limit(BATCH_SIZE) 

  if (dueError) console.log("Error Fetching Due Items:", dueError.message)

  let questions = dueItems?.map(item => {
    if (!item.questions) return null; 
    return {
        ...item.questions,
        _is_new: false, 
        choices: typeof item.questions.choices === 'string' 
        ? JSON.parse(item.questions.choices) 
        : item.questions.choices
    }
  }).filter(Boolean) || []

  // B. If we have fewer than 20 items, fetch NEW questions
  if (questions.length < BATCH_SIZE) {
    const { data: seenIds } = await supabase
      .from('student_progress')
      .select('question_id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)

    const seenIdArray = seenIds?.map(x => x.question_id) || []
    
    let query = supabase
      .from('questions')
      .select('*')
      .eq('course_id', courseId)
      .limit(BATCH_SIZE - questions.length) // Fill the rest to reach 20
    
    if (seenIdArray.length > 0) {
      query = query.not('id', 'in', `(${seenIdArray.join(',')})`)
    }

    const { data: newQuestions, error: newError } = await query

    if (newError) console.log("Error Fetching New Questions:", newError.message)

    if (newQuestions) {
      const formattedNew = newQuestions.map(q => ({
        ...q,
        _is_new: true, 
        choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices
      }))
      questions = [...questions, ...formattedNew]
    }
  }
  
  console.log(`Returning ${questions.length} questions to student.`)
  return { questions: questions.sort(() => Math.random() - 0.5) }
}

// 2. Save Result (SM-2 Algorithm Implementation)
export async function submitQuizResult(courseId, questionId, isCorrect, timeTaken) {
  // [DEBUG] Start Logging
  console.log(`\n!!! SUBMITTING ANSWER: Question ${questionId} !!!`)
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.error("❌ Save Failed: No User Logged In")
    return
  }

  // 1. Calculate Quality
  const quality = calculateQuality(isCorrect, timeTaken)
  console.log(`Time: ${timeTaken}s | IsCorrect: ${isCorrect} | SM-2 Quality: ${quality}`)

  // 2. Fetch previous state
  const { data: prev, error: fetchError } = await supabase
    .from('student_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('question_id', questionId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 just means "no rows found", which is fine for new items
     console.error("Error fetching previous state:", fetchError.message)
  }

  // 3. --- SM-2 ALGORITHM LOGIC START ---
  let prevEase = prev?.ease_factor || 2.5
  let prevInterval = prev?.interval || 0
  let prevReps = prev?.repetitions || 0

  let newEase = prevEase
  let newInterval = 0
  let newReps = 0

  if (quality >= 3) {
    // Correct Answer Logic
    if (prevReps === 0) newInterval = 1
    else if (prevReps === 1) newInterval = 6
    else newInterval = Math.round(prevInterval * prevEase)
    
    newReps = prevReps + 1
    newEase = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if (newEase < 1.3) newEase = 1.3 
  } else {
    // Incorrect Answer Logic
    newReps = 0
    newInterval = 1 
  }
  // --- SM-2 ALGORITHM LOGIC END ---

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + newInterval)

  console.log(`Update Plan: Interval ${prevInterval}->${newInterval} days | Next Review: ${nextDate.toISOString()}`)

  // 4. Upsert to DB
  const { error: saveError } = await supabase
    .from('student_progress')
    .upsert({
      user_id: user.id,
      course_id: courseId,
      question_id: questionId,
      is_correct: isCorrect,
      time_taken: timeTaken,
      quality_rating: quality,
      ease_factor: newEase,
      interval: newInterval,
      repetitions: newReps,
      next_review_date: nextDate.toISOString(),
      last_answered_at: new Date().toISOString()
    }, { onConflict: 'user_id, question_id' }) // Explicitly tell Supabase to check this pair

  if (saveError) {
    console.error("❌ CRITICAL: Database Save Error:", saveError.message)
    console.error("Details:", saveError.details)
    console.error("Hint:", saveError.hint)
  } else {
    console.log("✅ Success! Progress saved to DB.")
  }
  
  revalidatePath(`/dashboard/student/course/${courseId}`)
}