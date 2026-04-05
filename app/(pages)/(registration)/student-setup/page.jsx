// app/registration/student-setup/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../_lib/supabaseClient'; // Updated path
import { saveTursoProfile } from '@/app/actions/profiles';

export default function StudentSetup() {
  const router = useRouter();

  // Form States
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [academicLevelId, setAcademicLevelId] = useState('');
  const [programId, setProgramId] = useState('');

  // Dropdown Data Lists
  const [levelsList, setLevelsList] = useState([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 1. Fetch User & Dropdown Data
  useEffect(() => {
    const initializePage = async () => {
      // A. Get User Info
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email);
        setFullName(user.user_metadata.full_name);
      } else {
        router.push('/');
        return;
      }

      // B. Fetch Academic Levels
      const { data: levels, error: levelsError } = await supabase
        .from('academic_levels')
        .select('id, name')
        .order('name', { ascending: true });

      if (levelsError) {
        console.error('academic_levels:', levelsError);
        setMessage(
          'Could not load academic levels. Ask your admin to run supabase/migrations/add_academic_levels_standalone.sql in Supabase SQL.',
        );
      } else if (levels) {
        setLevelsList(levels);
      }

      setLoading(false);
    };

    initializePage();
  }, [router]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Save the Profile row in Supabase (columns must match public.profiles — no legacy `role` column)
    const profileData = {
      id: user.id,
      full_name: fullName,
      email: user.email,
    };

    const { error } = await supabase.from('profiles').upsert(profileData);

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    const tursoResult = await saveTursoProfile({
      full_name: fullName,
      email: user.email,
      academic_level_id: academicLevelId,
      program_id: programId
    });

    if (tursoResult?.success) {
      router.push('/dashboard/student');
    } else {
      setMessage(tursoResult?.error || 'Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex font-inter items-center justify-center min-h-screen brand-background brand-secondary">
        Loading options...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen brand-background">
      <div className="w-full max-w-lg p-8 space-y-6 brand-background rounded-lg shadow-md inset-shadow-sm shadow-indigo-600 inset-shadow-indigo-600">
        <h2 className="text-2xl font-bold font-poppins leading-8 text-center brand-primary">
          Complete Your Student Profile
        </h2>

        <form className="flex flex-col gap-6" onSubmit={handleProfileSave}>
          {/* Email (Read Only) */}
          <div>
            <label className="block text-sm font-semi-bold font-inter brand-secondary leading-6">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="text-base font-medium font-inter leading-6 w-full px-3 py-2 mt-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>

          {/* Username (Editable) */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-semi-bold font-inter brand-secondary leading-6"
            >
              Username
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="text-base font-medium font-inter leading-6 w-full px-3 py-2 mt-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>

          <hr className="brand-primary" />

          {/* Academic Level Dropdown */}
          <div>
            <label
              htmlFor="academicLevel"
              className="block text-sm font-semi-bold font-inter brand-secondary leading-6"
            >
              Academic Level
            </label>
            <select
              id="academicLevel"
              required
              value={academicLevelId}
              onChange={(e) => setAcademicLevelId(e.target.value)}
              className="text-base font-medium font-inter leading-6 w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select your level...</option>
              {levelsList.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>

          {/* Program Input */}
          <div>
            <label
              htmlFor="program"
              className="block text-sm font-semi-bold font-inter brand-secondary leading-6"
            >
              Program / Strand
            </label>
            <input
              id="program"
              type="text"
              required
              placeholder="e.g. BS Computer Science"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="text-base font-medium font-inter leading-6 w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="text-base w-full px-4 py-2 font-inter font-semibold leading-6 text-gray-100 brand-cta rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Profile & Go to Dashboard'}
          </button>

          {message && (
            <p className="text-sm text-center text-gray-600">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
