'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

/**
 * Fetches the review schedule for a student across all their courses.
 * Returns data grouped by date, with topic and course details for each day.
 */
export async function fetchReviewSchedule() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return {};

    try {
        const db = await getDbClient();

        // 1. Get ALL progress records for this user (scheduled reviews)
        const scheduledResult = await db.execute({
            sql: `
                SELECT 
                    sp.next_review_date,
                    c.id as course_id,
                    c.name as course_name,
                    q.material_id,
                    COALESCE(lm.topic_name, lm.file_name, 'Uncategorized') as topic_name,
                    COUNT(*) as question_count
                FROM student_progress sp
                JOIN questions q ON sp.question_id = q.id
                JOIN courses c ON sp.course_id = c.id
                LEFT JOIN learning_materials lm ON q.material_id = lm.id
                WHERE sp.user_id = ?
                  AND sp.next_review_date IS NOT NULL
                GROUP BY SUBSTR(sp.next_review_date, 1, 10), c.id, q.material_id
                ORDER BY sp.next_review_date ASC
            `,
            args: [user.id]
        });

        // 2. Get new questions (no progress yet) — these are "due today"
        const newResult = await db.execute({
            sql: `
                SELECT 
                    c.id as course_id,
                    c.name as course_name,
                    q.material_id,
                    COALESCE(lm.topic_name, lm.file_name, 'Uncategorized') as topic_name,
                    COUNT(*) as question_count
                FROM questions q
                JOIN courses c ON q.course_id = c.id
                LEFT JOIN learning_materials lm ON q.material_id = lm.id
                WHERE c.student_id = ?
                  AND q.id NOT IN (
                      SELECT question_id FROM student_progress WHERE user_id = ?
                  )
                GROUP BY c.id, q.material_id
            `,
            args: [user.id, user.id]
        });

        // Build the schedule map: { "2026-03-02": [...] }
        const scheduleMap = {};

        for (const row of scheduledResult.rows) {
            // Extract YYYY-MM-DD from the ISO string
            const rawDate = row.next_review_date;
            if (!rawDate) continue;
            const date = String(rawDate).substring(0, 10);
            if (!date || date.length !== 10) continue;

            if (!scheduleMap[date]) scheduleMap[date] = [];

            // Check if already have an entry for this course+topic on this date
            const existing = scheduleMap[date].find(
                e => e.course_id === row.course_id && e.material_id === row.material_id
            );
            if (existing) {
                existing.question_count += Number(row.question_count);
            } else {
                scheduleMap[date].push({
                    course_id: row.course_id,
                    course_name: row.course_name,
                    material_id: row.material_id,
                    topic_name: row.topic_name || 'Uncategorized',
                    question_count: Number(row.question_count),
                });
            }
        }

        // Add new questions as due today
        const today = new Date().toISOString().substring(0, 10);
        if (newResult.rows.length > 0) {
            if (!scheduleMap[today]) scheduleMap[today] = [];
            for (const row of newResult.rows) {
                const existing = scheduleMap[today].find(
                    e => e.course_id === row.course_id && e.material_id === row.material_id
                );
                if (existing) {
                    existing.question_count += Number(row.question_count);
                } else {
                    scheduleMap[today].push({
                        course_id: row.course_id,
                        course_name: row.course_name,
                        material_id: row.material_id,
                        topic_name: row.topic_name || 'Uncategorized',
                        question_count: Number(row.question_count),
                    });
                }
            }
        }

        return scheduleMap;
    } catch (err) {
        console.error("Error fetching review schedule:", err);
        return {};
    }
}

/**
 * Fetches the total count of due questions across ALL courses for a student.
 * This powers the "Master Study" button on the dashboard.
 */
export async function fetchGlobalDueCount() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return { total: 0, courses: [] };

    try {
        const db = await getDbClient();
        const now = new Date().toISOString();

        // Due reviews (with progress records, next_review_date <= now)
        const dueResult = await db.execute({
            sql: `
                SELECT c.id as course_id, c.name as course_name, COUNT(*) as count
                FROM student_progress sp
                JOIN questions q ON sp.question_id = q.id
                JOIN courses c ON sp.course_id = c.id
                WHERE sp.user_id = ? AND sp.next_review_date <= ?
                GROUP BY c.id
            `,
            args: [user.id, now]
        });

        // New questions (never reviewed)
        const newResult = await db.execute({
            sql: `
                SELECT c.id as course_id, c.name as course_name, COUNT(*) as count
                FROM questions q
                JOIN courses c ON q.course_id = c.id
                WHERE c.student_id = ?
                  AND q.id NOT IN (
                      SELECT question_id FROM student_progress WHERE user_id = ?
                  )
                GROUP BY c.id
            `,
            args: [user.id, user.id]
        });

        // Merge results by course
        const courseMap = {};
        for (const row of dueResult.rows) {
            courseMap[row.course_id] = {
                course_id: row.course_id,
                course_name: row.course_name,
                count: Number(row.count),
            };
        }
        for (const row of newResult.rows) {
            if (courseMap[row.course_id]) {
                courseMap[row.course_id].count += Number(row.count);
            } else {
                courseMap[row.course_id] = {
                    course_id: row.course_id,
                    course_name: row.course_name,
                    count: Number(row.count),
                };
            }
        }

        const courses = Object.values(courseMap);
        const total = courses.reduce((sum, c) => sum + c.count, 0);

        return { total, courses };
    } catch (err) {
        console.error("Error fetching global due count:", err);
        return { total: 0, courses: [] };
    }
}
