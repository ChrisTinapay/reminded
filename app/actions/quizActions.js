'use server'

import { createClient } from '@/utils/supabase/server'
import { getDbClient } from '@/lib/turso'
import { revalidatePath } from 'next/cache'

// Helper: Fisher-Yates shuffle for randomizing choices
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper: Response Latency → Quality (q) Mapping
// Based on Fessenden (2022) — 10s cognitive flow threshold
// and Zhang et al. (2023) — latency as predictor of memory decay
function calculateQuality(isCorrect, timeTakenSeconds) {
  if (!isCorrect) return 0;              // Complete Blackout
  if (timeTakenSeconds <= 10) return 5;   // Perfect Recall (≤10s)
  if (timeTakenSeconds <= 20) return 4;   // Hesitant Recall (11–20s)
  return 3;                               // Difficult Recall (>20s)
}

// 1. Fetch Questions (optionally filtered by materialId for topic-specific sessions)
export async function getDueQuestions(courseId, materialId = null, clientToday = null) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    console.log("Auth Error:", authError?.message)
    return { error: 'Unauthorized' }
  }

  const today = clientToday || new Date().toISOString().substring(0, 10)
  const BATCH_SIZE = 20;

  try {
    const db = await getDbClient();

    // Build material filter
    const materialFilter = materialId ? ' AND q.material_id = ?' : '';
    const materialArg = materialId ? [Number(materialId)] : [];

    // A. Fetch items due for review (next_review_date <= now)
    const dueResult = await db.execute({
      sql: `
            SELECT q.* 
            FROM student_progress sp
            JOIN questions q ON sp.question_id = q.id
            WHERE sp.user_id = ? 
              AND sp.course_id = ? 
              AND sp.next_review_date <= ?
              ${materialFilter}
            LIMIT ?
        `,
      args: [user.id, Number(courseId), today, ...materialArg, BATCH_SIZE]
    });

    let questions = dueResult.rows.map(row => {
      const parsed = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
      return { ...row, _is_new: false, choices: shuffleArray(parsed) };
    });

    // B. If we have fewer than BATCH_SIZE items, fetch NEW questions (never reviewed)
    if (questions.length < BATCH_SIZE) {
      const newMaterialFilter = materialId ? ' AND q.material_id = ?' : '';
      const newMaterialArg = materialId ? [Number(materialId)] : [];

      const newResult = await db.execute({
        sql: `
                SELECT q.* FROM questions q
                LEFT JOIN student_progress sp ON sp.question_id = q.id AND sp.user_id = ?
                WHERE q.course_id = ? 
                  AND sp.id IS NULL
                  ${newMaterialFilter}
                LIMIT ?
            `,
        args: [user.id, Number(courseId), ...newMaterialArg, BATCH_SIZE - questions.length]
      });

      const newQuestions = newResult.rows.map(row => {
        const parsed = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
        return { ...row, _is_new: true, choices: shuffleArray(parsed) };
      });

      questions = [...questions, ...newQuestions];
    }

    return { questions: questions.sort(() => Math.random() - 0.5) }
  } catch (err) {
    console.error("Error Fetching Turso Questions:", err);
    return { error: 'Failed to fetch' }
  }
}

// 1b. Fetch Due Questions Globally (across ALL courses for Master Study button)
export async function getGlobalDueQuestions(clientToday = null) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const today = clientToday || new Date().toISOString().substring(0, 10)
  const BATCH_SIZE = 20;

  try {
    const db = await getDbClient();

    // A. Fetch items due for review across ALL courses
    const dueResult = await db.execute({
      sql: `
            SELECT q.*, c.name as course_name, 
                   COALESCE(lm.topic_name, lm.file_name, 'Unknown') as topic_name
            FROM student_progress sp
            JOIN questions q ON sp.question_id = q.id
            JOIN courses c ON sp.course_id = c.id
            LEFT JOIN learning_materials lm ON q.material_id = lm.id
            WHERE sp.user_id = ? 
              AND sp.next_review_date <= ?
            ORDER BY sp.next_review_date ASC
            LIMIT ?
        `,
      args: [user.id, today, BATCH_SIZE]
    });

    let questions = dueResult.rows.map(row => {
      const parsed = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
      return { ...row, _is_new: false, choices: shuffleArray(parsed) };
    });

    // B. Fill remaining with NEW questions from all courses
    if (questions.length < BATCH_SIZE) {
      const newResult = await db.execute({
        sql: `
                SELECT q.*, c.name as course_name,
                       COALESCE(lm.topic_name, lm.file_name, 'Unknown') as topic_name
                FROM questions q
                JOIN courses c ON q.course_id = c.id
                LEFT JOIN learning_materials lm ON q.material_id = lm.id
                LEFT JOIN student_progress sp ON sp.question_id = q.id AND sp.user_id = ?
                WHERE c.student_id = ? 
                  AND sp.id IS NULL
                LIMIT ?
            `,
        args: [user.id, user.id, BATCH_SIZE - questions.length]
      });

      const newQuestions = newResult.rows.map(row => {
        const parsed = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
        return { ...row, _is_new: true, choices: shuffleArray(parsed) };
      });

      questions = [...questions, ...newQuestions];
    }

    return { questions: questions.sort(() => Math.random() - 0.5) }
  } catch (err) {
    console.error("Error Fetching Global Due Questions:", err);
    return { error: 'Failed to fetch' }
  }
}


// 2. Save Result (SM-2 Algorithm - Standard Implementation)
export async function submitQuizResult(courseId, questionId, isCorrect, timeTaken, clientToday = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.error("Save Failed: No User Logged In")
    return
  }

  // 1. Calculate Quality
  const quality = calculateQuality(isCorrect, timeTaken)

  try {
    const db = await getDbClient();

    // 2. Fetch previous state
    const prevResult = await db.execute({
      sql: `SELECT interval, ease_factor FROM student_progress WHERE user_id = ? AND question_id = ?`,
      args: [user.id, Number(questionId)]
    });

    const prev = prevResult.rows.length > 0 ? prevResult.rows[0] : null;

    // 3. --- SM-2 ALGORITHM (Standard Parameters) ---
    let prevEase = prev?.ease_factor !== undefined ? prev.ease_factor : 2.5;
    let prevInterval = prev?.interval || 0;

    // Derive repetition count from interval history
    let prevReps = 0;
    if (prev) {
      if (prevInterval === 1) prevReps = 1;
      else if (prevInterval >= 6) prevReps = 2; // After first successful review cycle
    }

    let newEase = prevEase;
    let newInterval = 0;
    let newReps = 0;

    if (quality >= 3) {
      // Correct Answer: apply standard SM-2 intervals
      if (prevReps === 0) {
        newInterval = 1;        // First time: review tomorrow
      } else if (prevReps === 1) {
        newInterval = 6;        // Standard SM-2: 6 days (not 3)
      } else {
        newInterval = Math.round(prevInterval * prevEase);
      }

      newReps = prevReps + 1;

      // Standard SM-2 ease factor adjustment
      newEase = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (newEase < 1.3) newEase = 1.3;
    } else {
      // Incorrect Answer: reset to beginning
      newReps = 0;
      newInterval = 1;  // Review again tomorrow
      // Keep ease factor unchanged on failure (standard SM-2 behavior)
    }
    // --- SM-2 ALGORITHM END ---

    // Use client's local date for next_review_date calculation
    // Parse as local date, add interval, format as local YYYY-MM-DD (NOT toISOString which converts to UTC)
    const baseDate = clientToday ? new Date(clientToday + 'T00:00:00') : new Date();
    baseDate.setDate(baseDate.getDate() + newInterval);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const nextDateStr = `${yyyy}-${mm}-${dd}`;

    // 4. Upsert to DB
    await db.execute({
      sql: `
            INSERT INTO student_progress (user_id, course_id, question_id, interval, ease_factor, next_review_date) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, question_id) DO UPDATE SET
                interval = excluded.interval,
                ease_factor = excluded.ease_factor,
                next_review_date = excluded.next_review_date
        `,
      args: [
        user.id,
        Number(courseId),
        Number(questionId),
        newInterval,
        newEase,
        nextDateStr
      ]
    });

  } catch (err) {
    console.error("CRITICAL: Turso Database Save Error:", err)
  }

  revalidatePath(`/dashboard/student/course/${courseId}`)
}