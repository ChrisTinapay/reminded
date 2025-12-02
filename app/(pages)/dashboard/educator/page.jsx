// app/dashboard/educator/page.jsx
'use client'; // We are back to client-side rendering

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/_lib/supabaseClient'; // Use the basic client

export default function EducatorDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Fetch courses and their linked names
        const { data, error } = await supabase
          .from('courses')
          .select(
            `
            id,
            course_name,
            academic_levels ( name ),
            programs ( name )
          `
          )
          .eq('educator_id', user.id);

        if (data) setCourses(data);
      }
      setLoading(false);
    };

    fetchCourses();
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center font-inter leading-6 brand-secondary">
        Loading courses...
      </div>
    );

  // Empty State
  if (courses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold font-poppins brand-primary mb-4 ">
            Your Courses
          </h2>
          <p className="brand-secondary font-base font-inter mb-8">
            You don't have any courses yet. Get started by creating one.
          </p>
          <Link
            href="/dashboard/educator/create-course"
            className="rounded-lg brand-cta px-6 py-3 text-lg font-medium text-white shadow-md transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Create a New Course
          </Link>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-poppins font-bold brand-primary">
          Your Courses
        </h1>
        <Link
          href="/dashboard/educator/create-course"
          className="rounded-md brand-cta px-4 py-2 text-sm font-medium font-inter leading-6 text-white hover:bg-indigo-700 transition"
        >
          + New Course
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex flex-col justify-between overflow-hidden rounded-lg dark:bg-neutral-800 shadow-sm border border-indigo-500 dark:shadow-indigo-500 transition hover:shadow-md"
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <span className="inline-block px-2 py-1 text-xs font-inter font-medium text-indigo-600 bg-indigo-100 dark:text-indigo-100 dark:bg-indigo-600 rounded-full">
                  {course.programs?.name || 'General'}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold font-poppins brand-primary">
                {course.course_name}
              </h3>
              <p className="mt-1 text-sm font-inter brand-secondary">
                {course.academic_levels?.name || 'All Levels'}
              </p>
            </div>

            <div className="bg-neutral-100 dark:bg-neutral-700 px-6 py-4">
              <Link
                href={`/dashboard/educator/course/${course.id}`}
                className="text-sm font-inter font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300"
              >
                Manage Course &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
