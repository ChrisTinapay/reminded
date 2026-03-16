// app/dashboard/student/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/_lib/supabaseClient';

import { fetchDashboardData } from '@/app/actions/dashboard';
import StudyCalendar from '../_components/StudyCalendar';

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [globalDue, setGlobalDue] = useState({ total: 0, courses: [] });

  useEffect(() => {
    const fetchData = async () => {
      const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          // Single combined call instead of 4 separate ones
          const data = await fetchDashboardData(localToday);

          if (data.profile) {
            setStudentInfo(data.profile);
          } else if (user?.user_metadata?.full_name) {
            setStudentInfo({ full_name: user.user_metadata.full_name });
          }

          setCourses(data.courses);
          setSchedule(data.schedule);
          setGlobalDue(data.globalDue);
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
    <div className="space-y-10 max-w-6xl mx-auto">

      {/* Study Now - Master Button */}
      <section className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black mb-2 font-poppins">
              {globalDue.total > 0 ? `${globalDue.total} Questions Due` : 'All Caught Up!'}
            </h2>
            <p className="text-indigo-100 text-sm font-inter">
              {globalDue.total > 0
                ? `From ${globalDue.courses?.length || 0} course${(globalDue.courses?.length || 0) !== 1 ? 's' : ''} — Review now to keep your streak!`
                : 'No reviews due today. Great job staying on top of your studies!'}
            </p>
          </div>
          {globalDue.total > 0 && (
            <Link
              href="/dashboard/student/review"
              className="flex-shrink-0 bg-white text-indigo-700 font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-lg"
            >
              🚀 Study Now
            </Link>
          )}
        </div>
      </section>

      {/* Calendar */}
      <StudyCalendar schedule={schedule} />

      {/* Courses */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Courses</h2>
          <Link href="/dashboard/student/create-course"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md transition-all transform hover:scale-[1.03]"
          >
            + Create Course
          </Link>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link key={course.id} href={`/dashboard/student/course/${course.id}`}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-400" />
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors mb-2">
                    {course.course_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{course.topic_count || 0} topics</span>
                    <span>•</span>
                    <span>{new Date(course.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 text-lg mb-4 font-inter">No courses yet. Create your first course to get started!</p>
            <Link href="/dashboard/student/create-course"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl"
            >
              Create Your First Course
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
