'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../_lib/supabaseClient'
import { useState, useEffect } from 'react' // Import useState and useEffect

// --- Icon Components (these are all unchanged) ---
const DashboardIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
  </svg>
)
const ProfileIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const LogoutIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)
// --- End of Icons ---

export default function NavigationBar() {
  const router = useRouter()
  // 1. Add state to store the user's role
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // 2. Add useEffect to fetch the role when the component loads
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUserRole(profile.role)
        }
      }
      setLoading(false)
    }
    
    fetchUserRole()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/') // Redirect to welcome page
  }

  // A helper component for nav links
  const NavLink = ({ href, icon, text }) => (
    <Link href={href} className="flex flex-col items-center justify-center p-2 rounded-md text-gray-600 hover:bg-gray-100 md:flex-row md:justify-start md:space-x-3">
      {icon}
      <span className="text-xs md:text-base">{text}</span>
    </Link>
  )

  // Helper component for a loading placeholder
  const LoadingSkeleton = () => (
    <div className="flex flex-col items-center justify-center p-2 text-gray-400 animate-pulse md:flex-row md:justify-start md:space-x-3">
      <div className="w-6 h-6 bg-gray-200 rounded-md"></div>
      <span className="w-16 h-4 mt-1 bg-gray-200 rounded-md md:mt-0"></span>
    </div>
  )

  return (
    <nav className="fixed bottom-0 left-0 z-40 flex h-16 w-full flex-row items-center justify-around border-t border-gray-200 bg-white md:fixed md:top-0 md:right-0 md:h-screen md:w-64 md:flex-col md:items-stretch md:justify-start md:space-y-4 md:border-t-0 md:border-l md:p-4">
      {/* 3. This section is now dynamic */}
      <div className="flex w-full flex-row justify-around md:flex-col md:space-y-2">
        {loading ? (
          // Show placeholders while loading the user's role
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          // Once loaded, show the correct links
          <>
            <NavLink
              href={userRole === 'student' ? '/dashboard/student' : '/dashboard/educator'}
              icon={<DashboardIcon />}
              text="Dashboard"
            />
            <NavLink href="/profile" icon={<ProfileIcon />} text="Profile" />
          </>
        )}
      </div>

      {/* Spacer for desktop */}
      <div className="hidden md:block md:flex-grow" />

      {/* Logout Button (unchanged) */}
      <button
        onClick={handleSignOut}
        className="flex flex-col items-center justify-center p-2 text-red-600 rounded-md hover:bg-red-50 md:flex-row md:justify-start md:space-x-3"
      >
        <LogoutIcon />
        <span className="text-xs md:text-base">Log Out</span>
      </button>
    </nav>
  )
}