// app/dashboard/layout.jsx
import Header from './_components/Header';
import NavigationBar from './_components/NavigationBar';

// Back to a simple, non-async function
export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <NavigationBar />

      <main className="p-6 pb-20 md:pb-6 md:pr-64">{children}</main>
    </div>
  );
}
