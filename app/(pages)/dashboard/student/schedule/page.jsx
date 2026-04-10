import { redirect } from 'next/navigation';

/** Legacy path: schedule and calendar share the same student view (calendar + SM-2 guide). */
export default function StudentScheduleRedirectPage() {
  redirect('/dashboard/student/calendar');
}
