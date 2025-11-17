// components/NavigationBar.jsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// --- Icon Components (we'll just define them here for simplicity) ---
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

  return (
    <nav className="
      /* --- Mobile Styles (Default) --- */
      fixed bottom-0 left-0
      z-40
      flex h-16 w-full
      flex-row items-center justify-around
      border-t border-gray-200 bg-white
      
      /* --- Desktop Styles (md:) --- */
      md:fixed md:top-0 md:right-0
      md:h-screen md:w-64
      md:flex-col md:items-stretch md:justify-start
      md:space-y-4 md:border-t-0 md:border-l md:p-4
    ">
      
      {/* These links will stack horizontally on mobile and vertically on desktop */}
      <div className="flex w-full flex-row justify-around md:flex-col md:space-y-2">
        <NavLink href="/dashboard/student" icon={<DashboardIcon />} text="Dashboard" />
        <NavLink href="/profile" icon={<ProfileIcon />} text="Profile" />
        {/* We'll need to create /profile page later */}
      </div>

      {/* Spacer for desktop */}
      <div className="hidden md:block md:flex-grow" />

      {/* Logout Button */}
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