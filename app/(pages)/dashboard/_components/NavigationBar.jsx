'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/app/_lib/supabaseClient';
import { useState, useEffect, useRef, useCallback } from 'react';

// --- Icon Components ---
const DashboardIcon = () => (
  <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
  </svg>
);
const CalendarIcon = () => (
  <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V5m8 2V5M7 11h10M6 21h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);
const ProfileIcon = () => (
  <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// Nav link component defined outside render
function NavLink({ href, icon, text, active, collapsed }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 ${collapsed ? 'justify-center px-2' : 'px-3'
        } ${active
          ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-500/10 dark:text-indigo-200'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-50'
        }`}
      title={collapsed ? text : undefined}
    >
      <span className={active ? 'text-indigo-600' : ''}>{icon}</span>
      {!collapsed && (
        <span className="text-sm font-inter leading-6 whitespace-nowrap overflow-hidden">{text}</span>
      )}
    </Link>
  );
}

const MIN_WIDTH = 72;
const DEFAULT_WIDTH = 256;
const MAX_WIDTH = 320;
const COLLAPSE_THRESHOLD = 140;

export default function NavigationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) return parsed;
      }
    }
    return DEFAULT_WIDTH;
  });
  const isDragging = useRef(false);
  const sidebarRef = useRef(null);

  const isCollapsed = sidebarWidth < COLLAPSE_THRESHOLD;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Save to localStorage and dispatch event whenever width changes
  useEffect(() => {
    localStorage.setItem('sidebar-width', String(sidebarWidth));
    window.dispatchEvent(new CustomEvent('sidebar-resize', { detail: sidebarWidth }));
  }, [sidebarWidth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Active page check
  const isDashboardActive = pathname === '/dashboard/student' || pathname === '/dashboard/student/';
  const isCalendarActive = pathname.startsWith('/dashboard/student/calendar');
  const isProfileActive = pathname.startsWith('/dashboard/student/profile');

  return (
    <>
      {/* Desktop Sidebar */}
      <nav
        ref={sidebarRef}
        className="hidden md:flex fixed top-0 left-0 h-screen flex-col items-stretch justify-start border-r brand-border brand-background z-40"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Logo */}
        <div className={`flex items-center py-5 ${isCollapsed ? 'justify-center px-2' : 'justify-center px-4'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`transition-all duration-200 ${isCollapsed ? 'h-10 w-10' : 'h-24 w-24'}`}
            src="/logo.png"
            alt="RemindED"
          />
        </div>

        {/* Nav Links */}
        <div className="flex flex-col space-y-1 px-3">
          <NavLink
            href="/dashboard/student"
            icon={<DashboardIcon />}
            text="Dashboard"
            active={isDashboardActive}
            collapsed={isCollapsed}
          />
          <NavLink
            href="/dashboard/student/calendar"
            icon={<CalendarIcon />}
            text="Calendar"
            active={isCalendarActive}
            collapsed={isCollapsed}
          />
          <NavLink
            href="/dashboard/student/profile"
            icon={<ProfileIcon />}
            text="Profile"
            active={isProfileActive}
            collapsed={isCollapsed}
          />
        </div>

        {/* Spacer */}
        <div className="grow" />

        {/* Logout */}
        <div className="px-3 pb-6">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 w-full ${isCollapsed ? 'justify-center px-2' : 'px-3'
              }`}
            title={isCollapsed ? 'Log Out' : undefined}
          >
            <LogoutIcon />
            {!isCollapsed && (
              <span className="text-sm font-inter leading-6 whitespace-nowrap">Log Out</span>
            )}
          </button>
        </div>

        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-400/50 active:bg-indigo-500/50 transition-colors z-50"
        />
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 z-40 flex h-16 w-full flex-row items-center justify-around border-t brand-border brand-background">
        <Link
          href="/dashboard/student"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-md ${isDashboardActive ? 'text-indigo-600' : 'text-gray-600'
            }`}
        >
          <DashboardIcon />
          <span className="text-xs font-inter">Dashboard</span>
        </Link>
        <Link
          href="/dashboard/student/calendar"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-md ${isCalendarActive ? 'text-indigo-600' : 'text-gray-600'
            }`}
        >
          <CalendarIcon />
          <span className="text-xs font-inter">Calendar</span>
        </Link>
        <Link
          href="/dashboard/student/profile"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-md ${isProfileActive ? 'text-indigo-600' : 'text-gray-600'
            }`}
        >
          <ProfileIcon />
          <span className="text-xs font-inter">Profile</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center py-2 px-4 text-red-500 rounded-md"
        >
          <LogoutIcon />
          <span className="text-xs font-inter">Log Out</span>
        </button>
      </nav>
    </>
  );
}
