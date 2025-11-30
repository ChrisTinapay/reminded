import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// CORRECT: Use createBrowserClient to automatically handle Cookies
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
