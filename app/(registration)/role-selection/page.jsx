// app/profile-setup/page.js
// app/registration/role-selection/page.jsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SelectRole() {
  const [role, setRole] = useState('') // Stores 'student' or 'educator'
  const router = useRouter()

  const handleContinue = () => {
    if (role) {
      // TODO: Where should this button navigate to?
      // We need to update this path to point to your
      // "profile fill out" form page.
      // What is the new URL for that page?
      router.push(`/role-selection?role=${role}`) 
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          How will you be using ReMindEd?
        </h2>
        
        <div className="flex mt-2 space-x-4">
          {/* Student Card */}
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex flex-col items-center justify-center w-full p-6 border-2 rounded-lg transition-all ${
              role === 'student' 
                ? 'border-blue-600 bg-blue-50' 
                : 'border-gray-300 bg-white hover:bg-gray-100'
            }`}
          >
            <span className="text-lg font-medium">I am a Student</span>
          </button>

          {/* Educator Card */}
          <button
            type="button"
            onClick={() => setRole('educator')}
            className={`flex flex-col items-center justify-center w-full p-6 border-2 rounded-lg transition-all ${
              role === 'educator' 
                ? 'border-blue-600 bg-blue-50' 
                : 'border-gray-300 bg-white hover:bg-gray-100'
            }`}
          >
            <span className="text-lg font-medium">I am an Educator</span>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!role} // Button is disabled until a role is selected
          className="w-full px-4 py-3 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}