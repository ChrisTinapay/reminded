// app/page.js
'use client';

import { useEffect } from 'react';
import { supabase } from './_lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ThemeToggle from './_components/ThemeToggle';

export default function Welcome() {
  const router = useRouter();

  // --- All your useEffect and handleGoogleLogin logic stays exactly the same ---
  useEffect(() => {
    const checkUserStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile) {
          router.push('/dashboard/student');
        } else {
          router.push('/student-setup');
        }
      }
    };

    checkUserStatus();
  }, [router]);

  const handleGoogleLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) {
      console.error('Error logging in with Google:', error.message);
    }
  };

  return (
    <div className="brand-background flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <ThemeToggle />
      <div className="mb-12 md:mb-16">
        <Image
          src="/logo.png"
          alt="RemindED Logo"
          width={200}
          height={200}
          className="w-[150px] h-auto md:w-[200px]"
          priority
        />
      </div>

      <button
        onClick={handleGoogleLogin}
        className="flex items-center justify-center w-full max-w-sm px-6 py-3 font-medium font text-gray-100 brand-cta rounded-lg shadow-md transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Continue with Google
      </button>
      <h1 className="mt-12 md:mt-16 text-2xl md:text-3xl font-bold brand-primary">
        Welcome to{' '}
        <span className="bg-linear-to-r from-brand-l via-brand-v to-brand-r bg-clip-text text-transparent">
          RemindED.
        </span>
      </h1>
    </div>
  );
}
