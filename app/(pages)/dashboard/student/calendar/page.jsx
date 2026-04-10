'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/_lib/supabaseClient';
import { fetchDashboardData } from '@/app/actions/dashboard';
import StudyCalendar from '../../_components/StudyCalendar';
import Sm2AlgorithmGuide from '../../_components/Sm2AlgorithmGuide';

export default function StudentCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const localToday = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchDashboardData(localToday);
        setSchedule(data.schedule || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading your calendar...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <StudyCalendar schedule={schedule} />
      <Sm2AlgorithmGuide />
    </div>
  );
}

