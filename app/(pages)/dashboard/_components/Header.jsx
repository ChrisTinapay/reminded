// components/Header.jsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/_lib/supabaseClient';
import Link from 'next/link';

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
      <header className="hidden md:flex items-center justify-between p-6 self-stretch bg-white shadow-md">
        {/* Welcome Message */}
        <div className="hidden md:block">
          {fullName && (
            <h1 className="text-2xl font-semibold font-poppins text-gray-800 leading-8">
              Welcome,{' '}
              <span className="bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
                {fullName}!
              </span>
            </h1>
          )}
        </div>
      </header>
    </>
  );
}
