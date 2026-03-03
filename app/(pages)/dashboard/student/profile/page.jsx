'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/_lib/supabaseClient';
import { getTursoProfile, saveTursoProfile } from '@/app/actions/profiles';

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Profile State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [academicLevelId, setAcademicLevelId] = useState('');
    const [programId, setProgramId] = useState('');

    // Dropdown Lists
    const [levelsList, setLevelsList] = useState([]);

    useEffect(() => {
        const fetchProfileAndOptions = async () => {
            try {
                // 1. Fetch the user's Turso profile
                const profile = await getTursoProfile();
                if (profile) {
                    setFullName(profile.full_name || '');
                    setEmail(profile.email || '');
                    setAcademicLevelId(profile.academic_level_id || '');
                    setProgramId(profile.program_id || '');
                } else {
                    // Fallback to supabase auth user if no Turso profile
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        setEmail(user.email || '');
                        if (user.user_metadata?.full_name) {
                            setFullName(user.user_metadata.full_name);
                        }
                    }
                }

                // 2. Fetch dropdown options for level from Supabase
                const { data: levels } = await supabase
                    .from('academic_levels')
                    .select('id, name')
                    .order('name', { ascending: true });

                if (levels) setLevelsList(levels);

            } catch (err) {
                console.error("Error loading profile data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileAndOptions();
    }, []);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });

        try {
            // We also update the displayName in Supabase just to keep them in sync if we want,
            // but the main location will be Turso!
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Update user metadata in Supabase (Auth side)
                await supabase.auth.updateUser({
                    data: { full_name: fullName }
                });

                // Update profile in Turso (App side)
                await saveTursoProfile({
                    full_name: fullName,
                    email: email,
                    academic_level_id: academicLevelId,
                    program_id: programId
                });

                window.dispatchEvent(new Event('profileUpdated'));
                setMessage({ text: 'Profile updated successfully!', type: 'success' });
            }
        } catch (err) {
            console.error(err);
            setMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-inter">Loading profile data...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 font-poppins">Profile</h1>
                    <p className="text-gray-500 font-inter text-sm">
                        Manage your personal information and preferences.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-2xl">
                {message.text && (
                    <div className={`mb-6 p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {message.text}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleSaveProfile}>
                    {/* Email (Read Only) */}
                    <div>
                        <label className="block text-sm font-bold font-inter text-gray-700 leading-6">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-500 font-medium font-inter shadow-sm cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500 font-inter">Your email cannot be changed.</p>
                    </div>

                    {/* Username */}
                    <div>
                        <label htmlFor="fullName" className="flex items-center text-sm font-bold font-inter text-gray-700 leading-6">
                            Username
                            <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </label>
                        <input
                            id="fullName"
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 font-medium font-inter shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <hr className="border-gray-200" />

                    {/* Academic Level */}
                    <div>
                        <label htmlFor="academicLevel" className="flex items-center text-sm font-bold font-inter text-gray-700 leading-6">
                            Academic Level
                            <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </label>
                        <select
                            id="academicLevel"
                            required
                            value={academicLevelId}
                            onChange={(e) => setAcademicLevelId(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 font-medium font-inter shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select your level...</option>
                            {levelsList.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Program/Course */}
                    <div>
                        <label htmlFor="program" className="flex items-center text-sm font-bold font-inter text-gray-700 leading-6">
                            Program / Strand
                            <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </label>
                        <input
                            id="program"
                            type="text"
                            required
                            placeholder="e.g. BS Computer Science"
                            value={programId}
                            onChange={(e) => setProgramId(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 font-medium font-inter shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-indigo-600 text-white font-inter font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
