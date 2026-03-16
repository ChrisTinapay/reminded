'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/_lib/supabaseClient';
import ThemeToggle from '@/app/_components/ThemeToggle';
import { getTursoProfile } from '@/app/actions/profiles';

export default function Header() {
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user?.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }

        // Check sessionStorage cache first to avoid Turso reads on every page
        const cached = sessionStorage.getItem('reminded-profile');
        if (cached) {
          const profile = JSON.parse(cached);
          setFullName(profile.full_name);
          return;
        }

        const profile = await getTursoProfile();
        if (profile) {
          setFullName(profile.full_name);
          // Cache for the session
          sessionStorage.setItem('reminded-profile', JSON.stringify(profile));
        } else if (user?.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchProfile();

    // Listen for profile updates (e.g., from profile edit page)
    const handleProfileUpdate = () => {
      sessionStorage.removeItem('reminded-profile'); // Clear cache
      fetchProfile();
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between p-6 self-stretch brand-background border-b border-gray-200">
        <div className="flex items-center gap-3">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border-2 border-indigo-200 shadow-sm"
            />
          )}
          {fullName && (
            <h1 className="text-2xl font-semibold font-poppins brand-primary leading-8">
              Welcome,{' '}
              <span className="bg-linear-to-r from-brand-l via-brand-v to-brand-r bg-clip-text text-transparent">
                {fullName}!
              </span>
            </h1>
          )}
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 brand-background border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="RemindED"
            className="h-8 w-8"
          />
          <span className="text-lg font-bold font-poppins bg-linear-to-r from-brand-l via-brand-v to-brand-r bg-clip-text text-transparent">
            RemindED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border-2 border-indigo-200 shadow-sm"
            />
          )}
        </div>
      </header>
    </>
  );
}
