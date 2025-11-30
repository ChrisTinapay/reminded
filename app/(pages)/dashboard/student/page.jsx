// app/dashboard/student/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/_lib/supabaseClient';

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);

  useEffect(() => {
    const fetchStudentCourses = async () => {
      // 1. Get the current User
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 2. FETCH STUDENT PROFILE (To get their IDs)
        const { data: profile } = await supabase
          .from('profiles')
          .select('academic_level_id, program_id, full_name')
          .eq('id', user.id)
          .single();

        if (profile) {
          setStudentInfo(profile);

          // 3. FETCH MATCHING COURSES (The "Bridge" Logic)
          const { data: matchedCourses, error } = await supabase
            .from('courses')
            .select(
              `
              id,
              course_name,
              educator_id,
              academic_levels ( name ),
              programs ( name ),
              profiles:educator_id ( full_name ) 
            `
            )
            // LOGIC: Only show courses that match the student's Level AND Program
            .eq('academic_level_id', profile.academic_level_id)
            .eq('program_id', profile.program_id);

          // Note: 'profiles:educator_id' is a special syntax.
          // It tells Supabase: "Follow the educator_id link to the profiles table
          // and get the full_name of the teacher."

          if (matchedCourses) setCourses(matchedCourses);
        }
      }
      setLoading(false);
    };

    fetchStudentCourses();
  }, []);

  if (loading)
    return <div className="p-8 text-center">Loading your courses...</div>;

  // Empty State (If no courses match yet)
  if (courses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Welcome, {studentInfo?.full_name}!
        </h2>
        <p className="text-gray-500 max-w-md">
          There are no courses created for your Academic Level and Program yet.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          (Wait for your instructors to add courses for your section)
        </p>
      </div>
    );
  }

  // Grid View
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">My Courses</h1>
        <p className="text-gray-500">
          Courses for {courses[0]?.academic_levels?.name} -{' '}
          {courses[0]?.programs?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/dashboard/student/course/${course.id}`} // We will create this page later
            className="block"
          >
            <div className="flex flex-col h-full overflow-hidden rounded-lg bg-white shadow-md transition hover:shadow-lg border border-transparent hover:border-blue-500">
              {/* Card Header (Color Strip) */}
              <div className="h-2 bg-blue-600 w-full"></div>

              <div className="p-6">
                {/* Program Tag */}
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                    {course.programs?.name}
                  </span>
                </div>

                {/* Course Name */}
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {course.course_name}
                </h3>

                {/* Instructor Name */}
                <p className="text-sm text-gray-500 flex items-center mt-4">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Instructor: {course.profiles?.full_name || 'Unknown'}
                </p>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                <span className="text-sm font-medium text-blue-600">
                  Start Studying &rarr;
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
