'use server'

import { SupabaseAuthContext } from '@core/adapters/auth/SupabaseAuthContext'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Returns a short-lived signed URL for a learning material PDF.
 * Enforces ownership by checking `courses.user_id` against the current user.
 */
export async function getSignedMaterialUrl(materialId, expiresInSeconds = 60 * 15) {
  try {
    const auth = new SupabaseAuthContext()
    const user = await auth.requireUser()

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('learning_materials')
      .select('id,file_path,course_id,courses!inner(user_id)')
      .eq('id', Number(materialId))
      .single()

    if (error) throw error
    if (!data) throw new Error('Material not found')

    const ownerId = data.courses?.user_id
    if (String(ownerId) !== String(user.id)) {
      throw new Error('Unauthorized')
    }

    const storagePath = data.file_path
    if (!storagePath) throw new Error('Material has no file_path')

    const { data: signed, error: signErr } = await supabase.storage
      .from('materials')
      .createSignedUrl(storagePath, Number(expiresInSeconds))

    if (signErr) throw signErr
    if (!signed?.signedUrl) throw new Error('Failed to create signed URL')

    return { success: true, url: signed.signedUrl }
  } catch (error) {
    return { success: false, error: String(error?.message || error) }
  }
}

