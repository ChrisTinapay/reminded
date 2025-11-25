// app/dashboard/educator/page.jsx
'use client' // We are back to client-side rendering

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient' // Use the basic client

export default function EducatorDashboard() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCourses = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch courses and their linked names
        const { data, error } = await supabase
          .from('courses')
          .select(`
            id,
            course_name,
            academic_levels ( name ),
            programs ( name )
          `)
          .eq('educator_id', user.id)
        
        if (data) setCourses(data)
      }
      setLoading(false)
    }

    fetchCourses()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading courses...</div>

  // Empty State
  if (courses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Your Courses
          </h2>
          <p className="text-gray-500 mb-8">
            You don't have any courses yet. Get started by creating one.
          </p>
          <Link
            href="/dashboard/educator/create-course"
            className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create a New Course
          </Link>
        </div>
      </div>
    )
  }

  // Grid View
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Your Courses</h1>
        <Link
          href="/dashboard/educator/create-course"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + New Course
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div key={course.id} className="flex flex-col justify-between overflow-hidden rounded-lg bg-white shadow-md transition hover:shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between">
                 <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                    {course.programs?.name || 'General'}
                 </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-gray-900">
                {course.course_name}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {course.academic_levels?.name || 'All Levels'}
              </p>
            </div>
            
            <div className="bg-gray-50 px-6 py-4">
              <Link
                href={`/dashboard/educator/course/${course.id}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Manage Course &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}