'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

/** Upload file to Supabase Storage — called at PUBLISH time only */
export async function uploadMaterialToStorage(formData) {
  try {
    const file = formData.get('file')
    if (!file) throw new Error('No file to upload')

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const safeFileName = uniquePrefix + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

    const { data, error } = await supabase.storage
      .from('materials')
      .upload(safeFileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Supabase Upload Error:', error.message)
      return { success: true, fileId: null, webViewLink: null }
    }

    return {
      success: true,
      fileId: safeFileName,
      webViewLink: null,
    }
  } catch (error) {
    console.error('Storage Upload Error:', error)
    return { success: true, fileId: null, webViewLink: null }
  }
}
