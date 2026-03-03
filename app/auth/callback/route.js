import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        await supabase.auth.exchangeCodeForSession(code)
    }

    // After exchanging the code for a session, redirect to the root page.
    // The existing useEffect in page.jsx will detect the session and
    // route the user to the correct dashboard or role-selection page.
    return NextResponse.redirect(origin)
}
