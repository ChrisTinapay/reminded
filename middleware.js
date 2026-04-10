import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session if needed (and may update auth cookies on `response`).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  function redirectHome() {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    // Forward full Set-Cookie headers from session refresh (keeps httpOnly, path, etc.).
    const rawCookies = response.headers.getSetCookie?.() ?? []
    for (const c of rawCookies) {
      redirectResponse.headers.append('Set-Cookie', c)
    }
    if (rawCookies.length === 0) {
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
    }
    return redirectResponse
  }

  // Dashboard is private: avoid showing the shell to signed-out visitors (or stale bookmarks).
  if (path.startsWith('/dashboard') && !user) {
    return redirectHome()
  }

  // Student setup only makes sense for a signed-in user finishing onboarding.
  if (path.startsWith('/student-setup') && !user) {
    return redirectHome()
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}