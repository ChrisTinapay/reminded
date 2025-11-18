// app/page.js
'use client'

import { useEffect } from 'react'
import { supabase } from './_lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image' // Import Image component for your logo

export default function Welcome() {
  const router = useRouter()

  // --- All your useEffect and handleGoogleLogin logic stays exactly the same ---
  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile && profile.role) {
          if (profile.role === 'student') {
            router.push('/dashboard/student')
          } else if (profile.role === 'educator') {
            router.push('/dashboard/educator')
          }
        } else {
          router.push('/role-selection')
        }
      }
    }

    checkUserStatus()
  }, [router])

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) {
      console.error('Error logging in with Google:', error.message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
      <div className="mb-12 md:mb-16">
        <Image
          src="/RemindED_Logo.png"
          alt="RemindED Logo"
          width={200} 
          height={200} 
          className="w-[150px] h-auto md:w-[200px]"
          priority
        />
      </div>

      <button
        onClick={handleGoogleLogin}
  
        className="flex items-center justify-center w-full max-w-sm px-6 py-3 font-medium text-white bg-indigo-600 rounded-lg shadow-md transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Continue with Google
      </button>
      <h1 className="mt-12 md:mt-16 text-2xl md:text-3xl font-bold text-foreground">
        Welcome to <span className="text-indigo-600">RemindED.</span>
      </h1>
    </div>
  )
}