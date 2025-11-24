// app/dashboard/educator/course/[courseId]/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation' // useParams lets us read the [courseId]
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient'

export default function CourseManagement() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId // This matches the folder name [courseId]

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCourseDetails = async () => {
      // Fetch specific course by ID
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          academic_levels ( name ),
          programs ( name )
        `)
        .eq('id', courseId)
        .single() // We expect only one match

      if (error) {
        console.error('Error fetching course:', error)
        alert('Course not found!')
        router.push('/dashboard/educator') // Go back if error
      } else {
        setCourse(data)
      }
      setLoading(false)
    }

    if (courseId) {
      fetchCourseDetails()
    }
  }, [courseId, router])

  if (loading) return <div className="p-8 text-center">Loading course details...</div>
  if (!course) return <div className="p-8 text-center">Course not found.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* --- Top Navigation / Breadcrumbs --- */}
      <div className="mb-6 flex items-center text-sm text-gray-500">
        <Link href="/dashboard/educator" className="hover:text-blue-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{course.course_name}</span>
      </div>

      {/* --- Header Section --- */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{course.course_name}</h1>
            <div className="flex items-center mt-2 gap-3">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                {course.programs?.name}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
                {course.academic_levels?.name}
              </span>
            </div>
          </div>
          
          <div className="flex gap-3">
             {/* Placeholder for Edit Button */}
            <button 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => alert('Edit feature coming soon!')}
            >
              Edit Settings
            </button>
            
            {/* Placeholder for Upload Material Button */}
            <button 
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              onClick={() => alert('Upload feature is the next step!')}
            >
              + Upload Material
            </button>
          </div>
        </div>
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Learning Materials List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[400px]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Learning Materials</h2>
            </div>
            
            <div className="p-8 text-center text-gray-500">
              {/* Empty State for Materials */}
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <p className="text-lg font-medium">No materials uploaded yet.</p>
              <p className="text-sm mt-1">Upload a PDF to start generating questions.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Stats / Students */}
        <div className="space-y-6">
          {/* Quick Stats Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Course Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Students Enrolled</span>
                <span className="font-bold">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Questions Generated</span>
                <span className="font-bold">0</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}