'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Actions
import { createCourse } from '../../../../actions/courses';

export default function CreateCourse() {
  const router = useRouter();

  // Form States
  const [courseName, setCourseName] = useState('');

  // Loading States
  const [loading, setLoading] = useState(false);

  // 1. SAVE COURSE Logic (Using Turso Server Action)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await createCourse({
        course_name: courseName,
      });

      if (response && response.success) {
        alert('Course created successfully!');
        router.push('/dashboard/student');
      }
    } catch (err) {
      alert(`Error creating course: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen py-12">
      <div className="w-full max-w-lg p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold font-poppins text-center brand-primary mb-8">
          Create Your Course
        </h1>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Course Name Input */}
          <div>
            <label
              htmlFor="courseName"
              className="block text-sm font-semi-bold font-inter brand-secondary"
            >
              Course Name
            </label>
            <input
              id="courseName"
              type="text"
              required
              placeholder="e.g., Graphic Design"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="mt-1 block w-full font-inter font-medium leading-6 rounded-md border bg-neutral-100 border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md brand-cta px-4 py-3 text-base font-inter font-semibold leading-6 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </form>
      </div>
    </div>
  );
}
