// app/dashboard/student/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/_lib/supabaseClient';

import { getTursoProfile } from '@/app/actions/profiles';
import { fetchCourses } from '@/app/actions/courses';
import { fetchReviewSchedule, fetchGlobalDueCount } from '@/app/actions/schedule';
import StudyCalendar from '../_components/StudyCalendar';

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [globalDue, setGlobalDue] = useState({ total: 0, courses: [] });

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const [profile, myCourses, reviewSchedule, dueCount] = await Promise.all([
            getTursoProfile(),
            fetchCourses(),
            fetchReviewSchedule(),
            fetchGlobalDueCount(),
          ]);

          if (profile) {
            setStudentInfo(profile);
          } else if (user?.user_metadata?.full_name) {
            setStudentInfo({ full_name: user.user_metadata.full_name });
          }

          if (myCourses) setCourses(myCourses);
          if (reviewSchedule) setSchedule(reviewSchedule);
          if (dueCount) setGlobalDue(dueCount);
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading)
    return <div className="p-8 text-center">Loading your courses...</div>;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, {studentInfo?.full_name}
          </p>
        </div>
        <Link
          href="/dashboard/student/create-course"
          className="rounded-md brand-cta px-4 py-2 text-sm font-medium font-inter leading-6 text-white hover:bg-indigo-700 shadow-sm transition"
        >
          + Create Course
        </Link>
      </div>

      {/* Master Study Button / Hero */}
      <div className={`rounded-2xl p-6 shadow-md border transition-all ${globalDue.total > 0
          ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white border-indigo-400/20'
          : 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-200'
        }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${globalDue.total > 0 ? 'bg-white/20' : 'bg-emerald-100'
              }`}>
              {globalDue.total > 0 ? (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              {globalDue.total > 0 ? (
                <>
                  <h2 className="text-xl font-bold">
                    {globalDue.total} question{globalDue.total !== 1 ? 's' : ''} due
                  </h2>
                  <p className="text-sm text-white/70 mt-0.5">
                    Across {globalDue.courses.length} course{globalDue.courses.length !== 1 ? 's' : ''} • {
                      globalDue.courses.map(c => c.course_name).join(', ')
                    }
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">You&apos;re all caught up!</h2>
                  <p className="text-sm text-emerald-600 mt-0.5">
                    No questions due right now. Check back later!
                  </p>
                </>
              )}
            </div>
          </div>
          {globalDue.total > 0 && (
            <Link
              href="/dashboard/student/review"
              className="flex-shrink-0 bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-3 px-6 rounded-xl shadow-md transition-all hover:shadow-lg text-sm"
            >
              Study Now
            </Link>
          )}
        </div>

        {/* Course breakdown chips */}
        {globalDue.total > 0 && globalDue.courses.length > 1 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {globalDue.courses.map((c) => (
              <span
                key={`due-${c.course_id}`}
                className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full"
              >
                {c.course_name}: {c.count} due
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Two-Column Layout: Calendar + Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Calendar - takes 3 columns on large screens */}
        <div className="lg:col-span-3">
          <StudyCalendar schedule={schedule} />
        </div>

        {/* Courses - takes 2 columns on large screens */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">Courses</h2>

          {courses.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-gray-200 border-dashed">
              <p className="text-gray-500">You haven&apos;t created any courses yet.</p>
              <Link
                href="/dashboard/student/create-course"
                className="text-indigo-600 hover:underline mt-2 inline-block font-medium"
              >
                Get started by creating your first course.
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <Link key={course.id} href={`/dashboard/student/course/${course.id}`} className="block">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group">
                    <div className="w-10 h-10 bg-indigo-100 group-hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{course.course_name}</h3>
                      <p className="text-xs text-gray-400">
                        {course.topic_count} topic{course.topic_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
