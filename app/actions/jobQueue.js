'use server'

import { createAdminClient } from '@/utils/supabase/admin'

function nowIso() {
  return new Date().toISOString()
}

/**
 * Enqueue a PDF → questions job. The worker will pick it up.
 *
 * Payload uses a Supabase Storage pointer (bucket + path) to avoid DB bloat.
 */
export async function enqueueQuizJobFromStorageRef({
  courseId,
  storageBucket,
  storagePath,
  fileName,
  mimeType,
}) {
  try {
    if (!storageBucket || !storagePath) {
      throw new Error('storageBucket and storagePath are required')
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('job_queue')
      .insert({
        status: 'pending',
        type: 'quiz_from_pdf',
        payload: {
          courseId: courseId ?? null,
          storageBucket,
          storagePath,
          fileName: fileName ?? null,
          mimeType: mimeType || 'application/pdf',
        },
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('id')
      .single()

    if (error) throw error

    return { success: true, jobId: data.id }
  } catch (error) {
    return { success: false, error: String(error?.message || error) }
  }
}

/**
 * Poll job status + result. Use from the UI to show progress.
 */
export async function getJobQueueJob(jobId) {
  try {
    if (!jobId) throw new Error('jobId is required')
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('job_queue')
      .select(
        'id,status,result,last_error,attempts,locked_at,created_at,updated_at,completed_at',
      )
      .eq('id', Number(jobId))
      .single()
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error?.message || error) }
  }
}

/**
 * Allows the client to re-run a job if it's stuck/failed.
 * Only the course owner can retry.
 */
export async function retryJobQueueJob(jobId) {
  try {
    if (!jobId) throw new Error('jobId is required')

    const auth = new (await import('@core/adapters/auth/SupabaseAuthContext')).SupabaseAuthContext()
    const user = await auth.requireUser()
    const supabase = createAdminClient()

    const { data: existing, error: readErr } = await supabase
      .from('job_queue')
      .select('id,status,payload')
      .eq('id', Number(jobId))
      .single()
    if (readErr) throw readErr

    const payload = existing?.payload || {}
    const courseId = payload.courseId
    if (!courseId) throw new Error('Job has no courseId')

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('user_id')
      .eq('id', Number(courseId))
      .single()
    if (courseErr) throw courseErr
    if (String(course.user_id) !== String(user.id)) throw new Error('Unauthorized')

    const { error: updErr } = await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        last_error: null,
        locked_at: null,
        updated_at: nowIso(),
      })
      .eq('id', Number(jobId))

    if (updErr) throw updErr
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error?.message || error) }
  }
}

