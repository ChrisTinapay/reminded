// app/dashboard/layout.jsx
import Header from '@/components/Header' // Import our new component
import NavigationBar from '@/components/NavigationBar' // Import the nav bar

export default function DashboardLayout({ children }) {
  // This 'children' prop is the actual page (student or faculty)
  return (
    <div className="flex flex-col min-h-screen">
      {/* The Header will be at the top of every page in the dashboard */}
      <Header />
      <NavigationBar />
      {/* The rest of the page content */}
      <main className="
        p-6 
        pb-20 
        md:pb-6  
        md:pr-64 ">
        {children}
      </main>
    </div>
  )
}