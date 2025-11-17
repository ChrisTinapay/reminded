// app/dashboard/layout.jsx
import Header from './_components/Header' // Import our new component
import NavigationBar from './_components/NavigationBar' // Import the nav bar

export default function DashboardLayout({ children }) {
  // This 'children' prop is the actual page (student or faculty)
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <NavigationBar />
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