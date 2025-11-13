// app/dashboard/layout.jsx
import Header from '@/components/Header' // Import our new component

export default function DashboardLayout({ children }) {
  // This 'children' prop is the actual page (student or faculty)
  return (
    <div className="flex flex-col min-h-screen">
      {/* The Header will be at the top of every page in the dashboard */}
      <Header />
      
      {/* The rest of the page content */}
      <main className="flex-grow p-6 bg-gray-50">
        {children}
      </main>
    </div>
  )
}