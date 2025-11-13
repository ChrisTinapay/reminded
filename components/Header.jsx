// components/Header.jsx
'use client' // This must be a client component to use state and effects

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'
// We will create this file next
// import MobileNav from './MobileNav' 

export default function Header() {
  // State to hold the user's name
  const [fullName, setFullName] = useState('')

  // This runs once when the header loads
  useEffect(() => {
    const fetchProfile = async () => {
      // 1. Get the logged-in user
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 2. Fetch their profile from the 'profiles' table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name') // We only need the full_name
          .eq('id', user.id)    // Where the id matches the user's id
          .single()           // Get just one row

        if (profile) {
          setFullName(profile.full_name)
        }
      }
    }
    
    fetchProfile()
  }, []) // The empty array means this only runs once

  return (
    <header className="flex items-center justify-between w-full p-4 bg-white shadow-md">
      {/* Logo (links to dashboard) */}
      <Link href="/dashboard/student"> {/* Or a generic /dashboard if you make one */}
        <Image
          src="/RemindED_Logo.png" // Assumes your logo is in /public/
          alt="ReMindEd Logo"
          width={100}
          height={40}
          className="w-auto h-10"
        />
      </Link>

      {/* Welcome Message */}
      <div className="hidden md:block"> {/* Hides on small screens */}
        <h1 className="text-xl font-semibold text-gray-700">
          Welcome, {fullName}!
        </h1>
      </div>

      {/* Right-side elements */}
      <div className="flex items-center space-x-4">
        {/* Profile Picture (from Google) - We can add this later */}
        {/* <Image ... /> */}
        
        {/* Hamburger Icon / Nav Menu */}
        {/* We will create and import this component next */}
        {/* <MobileNav /> */}
        <div className="p-2 border rounded-md md:hidden">
          {/* Placeholder for Hamburger Icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </div>
      </div>
    </header>
  )
}