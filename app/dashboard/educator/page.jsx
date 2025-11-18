// app/dashboard/educator/page.jsx
import Link from 'next/link'

export default function EducatorDashboard() {
  return (
    <div className="flex h-full items-center justify-center">
      {/* This div centers the button on the page */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Your Courses
        </h2>
        <p className="text-gray-500 mb-8">
          You don't have any courses yet. Get started by creating one.
        </p>
        
        {/* This button links to the new page route */}
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