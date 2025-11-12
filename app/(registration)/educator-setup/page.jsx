// app/registration/educator-setup/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function EducatorSetup() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  
  
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email)
        setFullName(user.user_metadata.full_name)
      } else {
        router.push('/') // No user, send them to login
      }
      setLoading(false)
    }
    fetchUser()
  }, [router])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('Error: No user found.')
      setLoading(false)
      return
    }

    const profileData = {
      id: user.id,
      full_name: fullName,
      role: 'educator', // We hard-code the role here
    }

    const { error } = await supabase.from('profiles').upsert(profileData)

    setLoading(false)

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      router.push('/dashboard/faculty') // Success! Send to dashboard
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading profile...</div>
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Complete Your Educator Profile
        </h2>
        
        <form className="space-y-6" onSubmit={handleProfileSave}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 mt-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
        <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Full Name
        </label>
        <input
            id="fullName"
            type="text"
            value={fullName} // Still pre-populated
            onChange={(e) => setFullName(e.target.value)} // Now it's editable
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" // Removed 'disabled' styles
        />
        </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Profile & Go to Dashboard'}
          </button>
          
          {message && <p className="text-sm text-center text-gray-600">{message}</p>}
        </form>
      </div>
    </div>
  )
}