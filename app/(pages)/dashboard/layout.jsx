// app/dashboard/layout.jsx
import Header from './_components/Header';
import NavigationBar from './_components/NavigationBar';

// Back to a simple, non-async function
export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <main className="md:flex-1 md:ml-64">
        <Header />
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
