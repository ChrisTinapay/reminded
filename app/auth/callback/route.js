import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWelcomeEmail } from '@/lib/services/email/WelcomeEmailService'

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        await supabase.auth.exchangeCodeForSession(code)

        // Avoid flashing the public login screen after OAuth.
        // Route directly to the correct authenticated destination.
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
            try {
                const admin = createAdminClient()
                const { data: profile, error } = await admin
                    .from('profiles')
                    .select('id')
                    .eq('id', user.id)
                    .maybeSingle()
                if (error) throw error

                // Only send the Welcome email on first-time registration (no profile row yet).
                if (!profile?.id && user.email) {
                    const name =
                        (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
                        'there'
                    const ok = await sendWelcomeEmail(user.email, String(name))
                    if (!ok) {
                        console.warn('[auth/callback] Welcome email failed; continuing signup flow.')
                    }
                }

                return NextResponse.redirect(new URL(profile ? '/dashboard/student' : '/student-setup', origin))
            } catch {
                // Fallback: send to dashboard; page-level logic can still handle missing profile.
                return NextResponse.redirect(new URL('/dashboard/student', origin))
            }
        }
    }

    // Default fallback: go home.
    return NextResponse.redirect(origin)
}
