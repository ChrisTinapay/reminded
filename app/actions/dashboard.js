'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

/**
 * Combined fetch for the entire dashboard — SINGLE auth check, SINGLE DB connection.
 * Consolidates legacy per-widget server actions into one fetch path.
 * This avoids repeated auth checks and DB connections.
 *
 * Before: ~5 Supabase auth calls + ~8 Turso queries per dashboard load
 * After:  1 Supabase auth call + 5 Turso queries per dashboard load
 */
export async function fetchDashboardData(clientToday = null) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { profile: null, courses: [], schedule: {}, globalDue: { total: 0, courses: [] } };
    }

    const today = clientToday || new Date().toISOString().substring(0, 10);

    try {
        const db = await getDbClient();

        // Run ALL queries in parallel on a single connection
        const [profileResult, coursesResult, scheduledResult, newQuestionsResult, dueByCoursResult] = await Promise.all([
            // 1. Profile
            db.execute({
                sql: "SELECT * FROM profiles WHERE id = ?",
                args: [user.id]
            }),

            // 2. Courses with topic count
            db.execute({
                sql: `SELECT c.*, 
                      (SELECT COUNT(*) FROM learning_materials lm WHERE lm.course_id = c.id) as topic_count
                      FROM courses c WHERE c.student_id = ? ORDER BY c.created_at DESC`,
                args: [user.id]
            }),

            // 3. Review schedule (all progress records with dates)
            db.execute({
                sql: `SELECT 
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
                    ORDER BY sp.next_review_date ASC`,
                args: [user.id]
            }),

            // 4. New questions (never reviewed) — for schedule "today" entry
            db.execute({
                sql: `SELECT 
                        c.id as course_id,
                        c.name as course_name,
                        q.material_id,
                        COALESCE(lm.topic_name, lm.file_name, 'Uncategorized') as topic_name,
                        COUNT(*) as question_count
                    FROM questions q
                    JOIN courses c ON q.course_id = c.id
                    LEFT JOIN learning_materials lm ON q.material_id = lm.id
                    LEFT JOIN student_progress sp ON sp.question_id = q.id AND sp.user_id = ?
                    WHERE c.student_id = ?
                      AND sp.id IS NULL
                    GROUP BY c.id, q.material_id`,
                args: [user.id, user.id]
            }),

            // 5. Due questions by course (for global due count)
            db.execute({
                sql: `SELECT c.id as course_id, c.name as course_name, COUNT(*) as count
                    FROM student_progress sp
                    JOIN questions q ON sp.question_id = q.id
                    JOIN courses c ON sp.course_id = c.id
                    WHERE sp.user_id = ? AND sp.next_review_date <= ?
                    GROUP BY c.id`,
                args: [user.id, today]
            }),
        ]);

        // Build profile
        const profile = profileResult.rows.length > 0 ? {
            id: profileResult.rows[0].id,
            full_name: profileResult.rows[0].full_name,
            email: profileResult.rows[0].email,
        } : null;

        // Build courses
        const courses = coursesResult.rows.map(row => ({
            id: row.id,
            course_name: row.name,
            student_id: row.student_id,
            topic_count: row.topic_count || 0,
            created_at: row.created_at
        }));

        // Build schedule map
        const scheduleMap = {};
        for (const row of scheduledResult.rows) {
            const rawDate = row.next_review_date;
            if (!rawDate) continue;
            const date = String(rawDate).substring(0, 10);
            if (!date || date.length !== 10) continue;

            if (!scheduleMap[date]) scheduleMap[date] = [];
            const existing = scheduleMap[date].find(e => e.course_id === row.course_id && e.material_id === row.material_id);
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

        // Add new questions as due today (using CLIENT's local date)
        if (newQuestionsResult.rows.length > 0) {
            if (!scheduleMap[today]) scheduleMap[today] = [];
            for (const row of newQuestionsResult.rows) {
                const existing = scheduleMap[today].find(e => e.course_id === row.course_id && e.material_id === row.material_id);
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

        // Build global due count
        const courseMap = {};
        for (const row of dueByCoursResult.rows) {
            courseMap[row.course_id] = {
                course_id: row.course_id,
                course_name: row.course_name,
                count: Number(row.count),
            };
        }
        // Add new questions to due count
        for (const row of newQuestionsResult.rows) {
            if (courseMap[row.course_id]) {
                courseMap[row.course_id].count += Number(row.question_count);
            } else {
                courseMap[row.course_id] = {
                    course_id: row.course_id,
                    course_name: row.course_name,
                    count: Number(row.question_count),
                };
            }
        }
        const globalDueCourses = Object.values(courseMap);
        const globalDueTotal = globalDueCourses.reduce((sum, c) => sum + c.count, 0);

        return {
            profile,
            courses,
            schedule: scheduleMap,
            globalDue: { total: globalDueTotal, courses: globalDueCourses }
        };
    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        return { profile: null, courses: [], schedule: {}, globalDue: { total: 0, courses: [] } };
    }
}
