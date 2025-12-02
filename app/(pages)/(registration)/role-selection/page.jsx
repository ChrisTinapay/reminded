// app/profile-setup/page.js
// app/registration/role-selection/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SelectRole() {
  const [role, setRole] = useState(''); // Stores 'student' or 'educator'
  const router = useRouter();

  const handleContinue = () => {
    if (role === 'student') {
      router.push('/student-setup');
    } else if (role === 'educator') {
      router.push('/educator-setup');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen brand-background">
      <div className="flex flex-col w-full max-w-md p-8 gap-8 brand-background rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center brand-primary">
          How will you be using{' '}
          <span className="bg-linear-to-r from-brand-l via-brand-v to-brand-r bg-clip-text text-transparent">
            ReMindEd?
          </span>
        </h2>

        <div className="flex flex-wrap mt-2 gap-6">
          {/* Student Card */}
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex flex-col items-center justify-center w-full p-6 border-2 rounded-lg transition-all ${
              role === 'student'
                ? 'border-indigo-600 bg-indigo-200 dark:bg-indigo-600'
                : 'border-indigo-600 shadow-sm shadow-indigo-600 bg-neutral-50 hover:bg-neutral-200/75 dark:bg-neutral-800 dark:hover:bg-neutral-800/75'
            }`}
          >
            <div className="flex flex-col justify-center items-center gap-4">
              <img
                className="w-20 h-16 invert-0 dark:invert"
                src="/student_icon.png"
                alt="Student logo"
              />
              <h1 className="text-base font-bold font-poppins leading-6 brand-primary">
                I am an Student
              </h1>
              <p className="brand-primary text-base font-poppins leading-6">
                I'll be joining courses and studying materials.
              </p>
            </div>
          </button>

          {/* Educator Card */}
          <button
            type="button"
            onClick={() => setRole('educator')}
            className={`flex flex-col items-center justify-center w-full p-6 border-2 rounded-lg transition-all ${
              role === 'educator'
                ? 'border-indigo-600 bg-indigo-200 dark:bg-indigo-600'
                : 'border-indigo-600 shadow-sm shadow-indigo-600 bg-neutral-50 hover:bg-neutral-200/75 dark:bg-neutral-800 dark:hover:bg-neutral-800/75'
            }`}
          >
            <div className="flex flex-col justify-center items-center gap-4">
              <img
                className="w-20 h-20 invert dark:invert-0"
                src="/educator_icon.png"
                alt="Educator logo"
              />
              <h1 className="text-base font-bold font-poppins leading-6 brand-primary">
                I am an Educator
              </h1>
              <p className="brand-primary text-base font-poppins leading-6">
                I'll be creating courses and uploading materials.
              </p>
            </div>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!role} // Button is disabled until a role is selected
          className="w-full px-4 py-3 font-bold font-poppins text-gray-100 brand-cta rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300/75 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
