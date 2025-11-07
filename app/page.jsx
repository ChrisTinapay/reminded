// app/page.js
'use client'

import { useEffect } from 'react' // Import useEffect
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation' // Import useRouter

export default function Welcome() {
  const router = useRouter() // Get the router

  // This hook runs automatically when the page loads
  useEffect(() => {
    
    // 1. Define a function to check the user's status
    const checkUserStatus = async () => {
      // 2. Get the current user from Supabase
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 3. If a user is logged in, check their profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role') // We only need to know their role
          .eq('id', user.id) // Get the profile where the ID matches the user's ID
          .single() // We expect only one row

        if (profile && profile.role) {
          // 4. User has a profile AND a role, send to dashboard
          if (profile.role === 'student') {
            router.push('/dashboard/student')
          } else if (profile.role === 'educator') {
            router.push('/dashboard/faculty')
          }
        } else {
          // 5. User is logged in, but has no role (or no profile)
          // This means they are a new user who needs to set up
          router.push('/role-selection')
        }
      }
      // 6. If no user is logged in (user is null), do nothing.
      // The user will just see the Welcome page below.
    }

    // 7. Call the function
    checkUserStatus()
  }, [router]) // The effect depends on the router

  // This function is still here for new users
  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) {
      console.error('Error logging in with Google:', error.message)
    }
  }

  // This is the HTML. Most users will be redirected *before*
  // they even see this, but new users will.
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 text-center bg-white rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-gray-800">
          Welcome to ReMindEd
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Your AI-powered spaced repetition learning tool.
        </p>
        
        <div className="mt-8">
          <button
            onClick={handleGoogleLogin}
            className="flex items-center justify-center w-full px-4 py-3 font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg /* Google Icon SVG */ >...</svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}