// app/dashboard/student/page.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/_lib/supabaseClient';

import { fetchDashboardData } from '@/app/actions/dashboard';
import { deleteCourse } from '@/app/actions/courses';
import ConfirmDialog from '@/app/components/ConfirmDialog';

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [globalDue, setGlobalDue] = useState({ total: 0, courses: [] });
  const [deletingCourseIds, setDeletingCourseIds] = useState(() => new Set());
  const [courseToDelete, setCourseToDelete] = useState(null);

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
          setGlobalDue(data.globalDue);

          // Users who already have courses skip only the create-form tour (they clearly created one before).
          // Do NOT auto-complete phase 1 — they should still see the dashboard "how to create a course" tour.
          if (data.courses?.length > 0) {
            try {
              if (window.localStorage.getItem('reminded_tour_phase_2_create_form') === null) {
                window.localStorage.setItem('reminded_tour_phase_2_create_form', '1');
              }
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const requestDeleteCourse = (course) => {
    if (!course?.id) return
    setCourseToDelete(course)
  }

  const handleConfirmDeleteCourse = async () => {
    const course = courseToDelete
    if (!course?.id) return
    setDeletingCourseIds((prev) => {
      const next = new Set(prev);
      next.add(String(course.id));
      return next;
    });
    try {
      const res = await deleteCourse(course.id);
      if (!res?.success) throw new Error(res?.error || 'Failed to delete course');
      setCourses((prev) => prev.filter((c) => String(c.id) !== String(course.id)));
      setGlobalDue((prev) => ({
        ...(prev || { total: 0, courses: [] }),
        total: Math.max(0, Number(prev?.total || 0) - Number(course?.due_count || 0)),
        courses: (prev?.courses || []).filter((c) => String(c.id) !== String(course.id)),
      }));
    } catch (err) {
      alert('Error deleting course: ' + (err?.message || String(err)));
    } finally {
      setDeletingCourseIds((prev) => {
        const next = new Set(prev);
        next.delete(String(course.id));
        return next;
      });
      setCourseToDelete(null)
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading your courses...</div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <ConfirmDialog
        open={Boolean(courseToDelete)}
        title="Delete course?"
        description={
          courseToDelete
            ? `This will permanently delete "${courseToDelete.course_name}", including all topics, questions, and progress.`
            : ''
        }
        confirmText="Delete course"
        cancelText="Cancel"
        tone="danger"
        busy={courseToDelete ? deletingCourseIds.has(String(courseToDelete.id)) : false}
        onClose={() => {
          if (courseToDelete && deletingCourseIds.has(String(courseToDelete.id))) return
          setCourseToDelete(null)
        }}
        onConfirm={handleConfirmDeleteCourse}
      />

      {/* Study Now - Master Button */}
      <section
        id="tour-dashboard-hero"
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden"
      >
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

      {/* Courses */}
      <section id="tour-dashboard-courses-section">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your Courses</h2>
          <Link
            id="tour-dashboard-create-btn"
            href="/dashboard/student/create-course"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-md transition-all transform hover:scale-[1.03]"
          >
            + Create Course
          </Link>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="group brand-card overflow-hidden hover:shadow-lg transition-all relative"
              >
                <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-400" />
                <button
                  type="button"
                  onClick={() => requestDeleteCourse(course)}
                  disabled={deletingCourseIds.has(String(course.id))}
                  className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-500/15"
                  title="Delete course"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <Link
                  href={`/dashboard/student/course/${course.id}`}
                  className="block"
                >
                  <div className="p-6 pr-14">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors mb-2">
                      {course.course_name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-400">
                      <span>{course.topic_count || 0} topics</span>
                      <span>•</span>
                      <span>{new Date(course.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-gray-400 text-lg mb-4 font-inter">No courses yet. Create your first course to get started!</p>
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
