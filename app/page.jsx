// app/page.js
'use client';

import { useEffect, useState } from 'react';
import { supabase } from './_lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ThemeToggle from './_components/ThemeToggle';
import Link from 'next/link';

export default function Welcome() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState(null);
  const [currentEmail, setCurrentEmail] = useState(null);

  useEffect(() => {
    const checkUserStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentEmail(user.email ?? null);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        setNextPath(profile ? '/dashboard/student' : '/student-setup');
      }
    };

    checkUserStatus();
  }, []);

  const handleContinue = () => {
    if (nextPath) router.push(nextPath);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setNextPath(null);
    setCurrentEmail(null);
  };

  const handleGoogleLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          // Force the account chooser instead of silently reusing a default Google session.
          prompt: 'select_account',
        },
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
        <Link href="https://www.reminded.site/landing" target="_blank" rel="noopener noreferrer">
          <Image
            src="/logo.png"
            alt="RemindED Logo"
            width={200}
            height={200}
            className="w-[150px] h-auto md:w-[200px] cursor-pointer"
            style={{ height: 'auto' }}
            priority
          />
        </Link>
      </div>

      {nextPath ? (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleContinue}
            className="flex items-center justify-center w-full px-6 py-3 font-medium font text-gray-100 brand-cta rounded-lg shadow-md transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue
          </button>
          <button
            onClick={handleSignOut}
            className="w-full px-6 py-3 font-medium rounded-lg border transition-colors text-gray-700 border-gray-300 hover:bg-gray-100/70 dark:text-gray-200/90 dark:border-white/15 dark:hover:bg-white/5"
          >
            Use a different account
          </button>
          {currentEmail ? (
            <div className="text-sm text-gray-600 dark:text-gray-200/70">
              Signed in as {currentEmail}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center w-full max-w-sm px-6 py-3 font-medium font text-gray-100 brand-cta rounded-lg shadow-md transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue with Google
        </button>
      )}
      <h1 className="mt-12 md:mt-16 text-2xl md:text-3xl font-bold brand-primary">
        Welcome to{' '}
        <span className="text-brand-gradient">
          RemindED.
        </span>
      </h1>
    </div>
  );
}
