// components/Header.jsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../_lib/supabaseClient'
import Link from 'next/link'


export default function Header() {
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name') 
          .eq('id', user.id)   
          .single()           

        if (profile) {
          setFullName(profile.full_name)
        }
      }
    }
    
    fetchProfile()
  }, []) // The empty array means this only runs once

  return (
    <>
    <header className="flex items-center justify-between w-full p-4 bg-white shadow-md">
      <Link href="/dashboard/student"> {/* Or a generic /dashboard if you make one */}
        {/* <Image
          src="/RemindED_Logo.png"
          width={100}
          height={40}
          className="w-auto h-10"
        /> */}
      </Link>

      {/* Welcome Message */}
<div className="hidden md:block">
  {/* Only render this heading if fullName is not an empty string */}
  {fullName && (
    <h1 className="text-xl font-semibold text-gray-700">
      Welcome, {fullName}!
    </h1>
  )}
</div>

      {/* Right-side elements */}
      <div className="flex items-center space-x-4">
        {/* Profile Picture (from Google) - We can add this later */}
        {/* <Image ... /> */}
        
        {/* Hamburger Icon / Nav Menu */}

          </div>
          </header>
         
   
    </>
  )
}