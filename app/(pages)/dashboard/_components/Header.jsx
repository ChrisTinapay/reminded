'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/_lib/supabaseClient';
import ThemeToggle from '@/app/_components/ThemeToggle';

export default function Header() {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name);
        }
      }
    };

    fetchProfile();
  }, []); // The empty array means this only runs once

  return (
    <>
      <header className="hidden md:flex items-center justify-between p-6 self-stretch brand-background border-b border-gray-200">
        {/* Welcome Message */}
        <div>
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
    </>
  );
}
