'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient'

export default function StudentList() {
  const params = useParams()
  const courseId = params.courseId

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [course, setCourse] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Course Info (for the title and bridge IDs)
      const { data: courseData } = await supabase
        .from('courses')
        .select('course_name, academic_level_id, program_id')
        .eq('id', courseId)
        .single()
      
      setCourse(courseData)

      // 2. Get Students based on the "Bridge" (Level + Program)
      if (courseData) {
        const { data: studentData } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .eq('academic_level_id', courseData.academic_level_id)
          .eq('program_id', courseData.program_id)
        
        if (studentData) setStudents(studentData)
      }
      setLoading(false)
    }

    if (courseId) fetchData()
  }, [courseId])

  // Filter students based on search
  const filteredStudents = students.filter(student => 
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) return <div className="p-8 text-center">Loading class roster...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
       {/* Breadcrumbs */}
       <div className="mb-6 flex items-center text-sm text-gray-500">
        <Link href={`/dashboard/educator/course/${courseId}`} className="hover:text-blue-600">
          {course?.course_name || 'Course'}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">Students</span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Class Roster</h1>
        {/* Placeholder Add Button */}
        <button onClick={() => alert('To add students manually, we need to create an enrollments table. For now, students are added automatically if their Level/Program matches!')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm">
            + Add Student
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* The Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.length === 0 ? (
                    <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                            No students found matching your search.
                        </td>
                    </tr>
                ) : (
                    filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                                        {student.full_name.charAt(0)}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {student.email || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Enrolled
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button className="text-red-600 hover:text-red-900">Remove</button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  )
}