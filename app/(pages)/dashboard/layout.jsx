'use client';

import { useState, useEffect } from 'react';
import Header from './_components/Header';
import NavigationBar from './_components/NavigationBar';

const DEFAULT_WIDTH = 256;

export default function DashboardLayout({ children }) {
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

  return (
    <div className="min-h-screen brand-background">
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
