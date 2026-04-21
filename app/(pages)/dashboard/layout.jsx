'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from './_components/Header';
import NavigationBar from './_components/NavigationBar';
import OnboardingTour from '@/components/OnboardingTour';

const DEFAULT_WIDTH = 256;

// Routes where the student must stay focused on answering questions.
// On these routes we hide the sidebar/header so students cannot navigate
// away mid-session by clicking Dashboard/Calendar/Profile/etc.
function isLockedReviewRoute(pathname) {
  if (!pathname) return false;
  if (pathname === '/dashboard/student/review') return true;
  if (pathname.startsWith('/dashboard/student/review/')) return true;
  // Per-course review: /dashboard/student/course/<id>/review
  if (/^\/dashboard\/student\/course\/[^/]+\/review(\/.*)?$/.test(pathname)) return true;
  return false;
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const lockedForReview = isLockedReviewRoute(pathname);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 72 && parsed <= 320) return parsed;
      }
    }
    return DEFAULT_WIDTH;
  });

  useEffect(() => {
    const handleResize = (e) => {
      setSidebarWidth(e.detail);
    };

    window.addEventListener('sidebar-resize', handleResize);
    return () => window.removeEventListener('sidebar-resize', handleResize);
  }, []);

  if (lockedForReview) {
    return (
      <div className="min-h-screen brand-background">
        <main className="min-h-screen">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-background">
      <OnboardingTour />
      <NavigationBar />
      <main
        className="transition-[margin-left] duration-75 pb-20 md:pb-0"
        style={{ marginLeft: undefined }}
      >
        {/* 
          On desktop (md+): apply sidebar margin via inline style
          On mobile: no margin needed (bottom nav only)
          We use a CSS media query approach via a wrapper div 
        */}
        <div className="md:hidden">
          <Header />
          <div className="p-4">{children}</div>
        </div>
        <div className="hidden md:block" style={{ marginLeft: `${sidebarWidth}px` }}>
          <Header />
          <div className="p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
