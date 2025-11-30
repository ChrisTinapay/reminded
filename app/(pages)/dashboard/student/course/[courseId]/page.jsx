'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient'

export default function CourseLobby() {
  const params = useParams()
  const courseId = params.courseId
  const [course, setCourse] = useState(null)
  const [stats, setStats] = useState({ total: 0, mastered: 0, due: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Course Details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*, profiles:educator_id(full_name)')
        .eq('id', courseId)
        .single()
      setCourse(courseData)

      // 2. Calculate Stats
      if (user) {
        // Count total questions available in the bank
        const { count: totalQ } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', courseId)

        // Fetch user progress
        const { data: progress } = await supabase
            .from('student_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('course_id', courseId)

        const now = new Date()
        const dueCount = progress?.filter(p => new Date(p.next_review_date) <= now).length || 0
        // We define "Mastered" as interval > 21 days
        const masteredCount = progress?.filter(p => p.interval > 21).length || 0

        setStats({ 
            total: totalQ || 0, 
            mastered: masteredCount, 
            due: dueCount 
        })
      }
      setLoading(false)
    }
    fetchData()
  }, [courseId])

  if (loading) return <div className="p-12 text-center text-gray-500">Loading course data...</div>
  if (!course) return <div className="p-12 text-center">Course not found.</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header Card */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.course_name}</h1>
        <p className="text-gray-500">Instructor: {course.profiles?.full_name}</p>
        
        <div className="mt-8 flex justify-center">
            <Link 
                href={`/dashboard/student/course/${courseId}/review`}
                className="group relative inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 px-12 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
                <span>Start Study Session</span>
                {stats.due > 0 && (
                   <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white ring-2 ring-white">
                     {stats.due}
                   </span>
                )}
            </Link>
        </div>
      </div>

      {/* Progress Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center">
            <h3 className="text-blue-800 font-semibold mb-1 text-sm uppercase tracking-wide">Total Questions</h3>
            <p className="text-4xl font-black text-blue-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col items-center">
            <h3 className="text-green-800 font-semibold mb-1 text-sm uppercase tracking-wide">Mastered</h3>
            <p className="text-4xl font-black text-green-900">{stats.mastered}</p>
            <p className="text-xs text-green-700 mt-2">Long-term Memory</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex flex-col items-center">
            <h3 className="text-orange-800 font-semibold mb-1 text-sm uppercase tracking-wide">Due for Review</h3>
            <p className="text-4xl font-black text-orange-900">{stats.due}</p>
            <p className="text-xs text-orange-700 mt-2">Needs Attention</p>
        </div>
      </div>
    </div>
  )
}