import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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
