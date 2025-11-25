// app/registration/student-setup/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../_lib/supabaseClient'; // Updated path

export default function StudentSetup() {
  const router = useRouter();

  // Form States
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [academicLevelId, setAcademicLevelId] = useState('');
  const [programId, setProgramId] = useState('');

  // Dropdown Data Lists
  const [levelsList, setLevelsList] = useState([]);
  const [programsList, setProgramsList] = useState([]);

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
      const { data: levels } = await supabase
        .from('academic_levels')
        .select('id, name')
        .order('name', { ascending: true });

      // C. Fetch Programs
      const { data: programs } = await supabase
        .from('programs')
        .select('id, name')
        .order('name', { ascending: true });

      if (levels) setLevelsList(levels);
      if (programs) setProgramsList(programs);

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

    // 2. Save the Profile with IDs
    const profileData = {
      id: user.id,
      full_name: fullName,
      role: 'student',
      academic_level_id: academicLevelId, // Saving the ID, not text
      program_id: programId, // Saving the ID, not text
    };

    const { error } = await supabase.from('profiles').upsert(profileData);

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    } else {
      router.push('/dashboard/student');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading options...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          Complete Your Student Profile
        </h2>

        <form className="space-y-6" onSubmit={handleProfileSave}>
          {/* Email (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 mt-1 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>

          {/* Full Name (Editable) */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <hr />

          {/* Academic Level Dropdown */}
          <div>
            <label
              htmlFor="academicLevel"
              className="block text-sm font-medium text-gray-700"
            >
              Academic Level
            </label>
            <select
              id="academicLevel"
              required
              value={academicLevelId}
              onChange={(e) => setAcademicLevelId(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select your level...</option>
              {levelsList.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>

          {/* Program Dropdown */}
          <div>
            <label
              htmlFor="program"
              className="block text-sm font-medium text-gray-700"
            >
              Program / Strand
            </label>
            <select
              id="program"
              required
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select your program...</option>
              {programsList.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
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
