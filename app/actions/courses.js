'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

export async function createCourse(courseData) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const db = await getDbClient();
        const { course_name, student_id } = courseData;

        // Verify the user is passing their own ID or default to their ID securely
        const finalStudentId = student_id || user.id;

        const result = await db.execute({
            sql: `INSERT INTO courses (name, student_id) VALUES (?, ?) RETURNING id`,
            args: [course_name, finalStudentId]
        });

        const newCourseId = result.rows[0].id;

        return { success: true, id: newCourseId };
    } catch (err) {
        console.error("Error creating course in Turso:", err);
        throw new Error("Failed to create course");
    }
}

export async function updateCourseName(courseId, newName) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        await db.execute({
            sql: "UPDATE courses SET name = ? WHERE id = ? AND student_id = ?",
            args: [newName.trim(), Number(courseId), user.id]
        });

        return { success: true };
    } catch (err) {
        console.error("Error updating course name:", err);
        throw new Error("Failed to update course name");
    }
}

export async function fetchCourseDetails(courseId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: `
                SELECT c.id, c.name as course_name, c.student_id, c.created_at, p.full_name
                FROM courses c
                LEFT JOIN profiles p ON c.student_id = p.id
                WHERE c.id = ?
            `,
            args: [Number(courseId)]
        });

        if (result.rows.length === 0) {
            return null; // Course not found
        }

        const row = result.rows[0];

        return {
            id: row.id,
            course_name: row.course_name,
            educator_id: row.student_id, // Map student_id to educator_id for frontend compatibility
            created_at: row.created_at,
            profiles: {
                full_name: row.full_name || "Instructor"
            },
            // Legacy schema properties for frontend compatibility
            academic_levels: { name: "All Levels" },
            programs: { name: "General" }
        };
    } catch (err) {
        console.error("Error fetching course details from Turso:", err);
        throw new Error("Failed to fetch course details");
    }
}

// Combined fetch for course page — single auth check, single DB connection
export async function fetchCoursePageData(courseId, clientToday = null) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    const today = clientToday || new Date().toISOString().substring(0, 10);

    try {
        const db = await getDbClient();

        // Run all queries in parallel on the same connection
        const [courseResult, materialsResult, statsResult, dueCountResult, newCountResult, masteredResult, topicDueResult, topicNewResult] = await Promise.all([
            // Course details
            db.execute({ sql: "SELECT * FROM courses WHERE id = ?", args: [Number(courseId)] }),
            // Materials
            db.execute({
                sql: `SELECT lm.*, (SELECT COUNT(*) FROM questions q WHERE q.material_id = lm.id) as question_count
                      FROM learning_materials lm WHERE lm.course_id = ? ORDER BY lm.created_at DESC`,
                args: [Number(courseId)]
            }),
            // Total questions
            db.execute({ sql: "SELECT COUNT(*) as count FROM questions WHERE course_id = ?", args: [Number(courseId)] }),
            // Due questions
            db.execute({
                sql: `SELECT COUNT(*) as count FROM student_progress WHERE user_id = ? AND course_id = ? AND next_review_date <= ?`,
                args: [user.id, Number(courseId), today]
            }),
            // New questions (never reviewed)
            db.execute({
                sql: `SELECT COUNT(*) as count FROM questions q LEFT JOIN student_progress sp ON sp.question_id = q.id AND sp.user_id = ? WHERE q.course_id = ? AND sp.id IS NULL`,
                args: [user.id, Number(courseId)]
            }),
            // Mastered (interval >= 21 days)
            db.execute({
                sql: `SELECT COUNT(*) as count FROM student_progress WHERE user_id = ? AND course_id = ? AND interval >= 21`,
                args: [user.id, Number(courseId)]
            }),
            // Per-topic due reviews
            db.execute({
                sql: `SELECT q.material_id, COUNT(*) as count FROM student_progress sp JOIN questions q ON sp.question_id = q.id WHERE sp.user_id = ? AND sp.course_id = ? AND sp.next_review_date <= ? GROUP BY q.material_id`,
                args: [user.id, Number(courseId), today]
            }),
            // Per-topic new questions
            db.execute({
                sql: `SELECT q.material_id, COUNT(*) as count FROM questions q LEFT JOIN student_progress sp ON sp.question_id = q.id AND sp.user_id = ? WHERE q.course_id = ? AND sp.id IS NULL GROUP BY q.material_id`,
                args: [user.id, Number(courseId)]
            })
        ]);

        // Build course
        if (courseResult.rows.length === 0) return null;
        const row = courseResult.rows[0];
        const course = { id: row.id, course_name: row.name, student_id: row.student_id, created_at: row.created_at };

        // Build materials
        const materials = materialsResult.rows.map(r => ({ id: r.id, course_id: r.course_id, file_name: r.file_name, file_path: r.file_path, topic_name: r.topic_name, question_count: r.question_count || 0, created_at: r.created_at }));

        // Build stats
        const totalQ = Number(statsResult.rows[0].count);
        const progressDue = Number(dueCountResult.rows[0].count);
        const newQ = Number(newCountResult.rows[0].count);
        const mastered = Number(masteredResult.rows[0].count);
        const stats = { total: totalQ, mastered, due: progressDue + newQ };

        // Build topic due counts
        const topicDue = {};
        for (const r of topicDueResult.rows) topicDue[r.material_id] = (topicDue[r.material_id] || 0) + Number(r.count);
        for (const r of topicNewResult.rows) topicDue[r.material_id] = (topicDue[r.material_id] || 0) + Number(r.count);

        return { course, materials, stats, topicDue };
    } catch (err) {
        console.error("Error fetching course page data:", err);
        throw new Error("Failed to fetch course page data");
    }
}


export async function saveLearningMaterial({ course_id, file_name, file_path, topic_name }) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: `INSERT INTO learning_materials (course_id, file_name, file_path, topic_name) VALUES (?, ?, ?, ?) RETURNING id`,
            args: [Number(course_id), file_name, file_path, topic_name || file_name]
        });

        return { success: true, id: result.rows[0].id };
    } catch (err) {
        console.error("Error saving learning material to Turso:", err);
        throw new Error("Failed to save learning material");
    }
}

export async function fetchLearningMaterials(courseId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: `SELECT lm.*, 
                  (SELECT COUNT(*) FROM questions q WHERE q.material_id = lm.id) as question_count
                  FROM learning_materials lm 
                  WHERE lm.course_id = ? ORDER BY lm.created_at DESC`,
            args: [Number(courseId)]
        });

        return result.rows.map(row => ({
            id: row.id,
            course_id: row.course_id,
            file_name: row.file_name,
            file_path: row.file_path,
            topic_name: row.topic_name || row.file_name,
            question_count: row.question_count || 0,
            created_at: row.created_at
        }));
    } catch (err) {
        console.error("Error fetching learning materials from Turso:", err);
        return [];
    }
}

export async function updateTopicName(materialId, newName) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        await db.execute({
            sql: "UPDATE learning_materials SET topic_name = ? WHERE id = ?",
            args: [newName.trim(), Number(materialId)]
        });

        return { success: true };
    } catch (err) {
        console.error("Error updating topic name:", err);
        throw new Error("Failed to update topic name");
    }
}

export async function checkTopicHasProgress(materialId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: `SELECT COUNT(*) as count FROM student_progress sp
                  JOIN questions q ON sp.question_id = q.id
                  WHERE q.material_id = ? AND sp.user_id = ?`,
            args: [Number(materialId), user.id]
        });

        return result.rows[0].count > 0;
    } catch (err) {
        console.error("Error checking topic progress:", err);
        return false;
    }
}

export async function deleteLearningMaterial(materialId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        // 1. Get the file_path so we can delete from Supabase Storage
        const materialResult = await db.execute({
            sql: "SELECT file_path FROM learning_materials WHERE id = ?",
            args: [Number(materialId)]
        });

        if (materialResult.rows.length === 0) throw new Error("Material not found");

        const filePath = materialResult.rows[0].file_path;

        // 2. Delete associated questions first
        await db.execute({
            sql: "DELETE FROM questions WHERE material_id = ?",
            args: [Number(materialId)]
        });

        // 3. Delete from Turso
        await db.execute({
            sql: "DELETE FROM learning_materials WHERE id = ?",
            args: [Number(materialId)]
        });

        // 4. Delete from Supabase Storage (extract filename from URL)
        try {
            // The file_path is a full Supabase public URL like:
            // https://xxx.supabase.co/storage/v1/object/public/materials/filename
            const urlParts = filePath.split('/materials/');
            if (urlParts.length > 1) {
                const storageFileName = decodeURIComponent(urlParts[1]);
                await supabase.storage.from('materials').remove([storageFileName]);
                console.log("Deleted from Supabase Storage:", storageFileName);
            }
        } catch (storageErr) {
            console.error("Warning: Failed to delete from storage (file may already be removed):", storageErr);
        }

        return { success: true };
    } catch (err) {
        console.error("Error deleting learning material:", err);
        throw new Error("Failed to delete learning material");
    }
}
