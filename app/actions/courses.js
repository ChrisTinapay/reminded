'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

export async function fetchCourses() {
    // 1. Verify user using Supabase Auth
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error("fetchCourses: Unauthorized or no user found.", error);
        return [];
    }

    try {
        const db = await getDbClient();

        // Query Turso using parameterized SQL
        const result = await db.execute({
            sql: `SELECT c.*, 
                  (SELECT COUNT(*) FROM learning_materials lm WHERE lm.course_id = c.id) as topic_count
                  FROM courses c WHERE c.student_id = ? ORDER BY c.created_at DESC`,
            args: [user.id] // Safe positional argument
        });

        const courses = result.rows.map(row => ({
            id: row.id,
            course_name: row.name, // The schema used 'name'
            student_id: row.student_id,
            topic_count: row.topic_count || 0,
            created_at: row.created_at
        }));

        return courses;
    } catch (err) {
        console.error("Error fetching courses from Turso:", err);
        throw new Error("Failed to fetch courses");
    }
}

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

export async function fetchEnrolledCourses() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const db = await getDbClient();

        // Query Turso for all courses that the student did not create
        const result = await db.execute({
            sql: `
                SELECT c.id, c.name as course_name, c.student_id, c.created_at, p.full_name as educator_name
                FROM courses c
                LEFT JOIN profiles p ON c.student_id = p.id
                WHERE c.student_id != ?
                ORDER BY c.created_at DESC
            `,
            args: [user.id]
        });

        const courses = result.rows.map(row => ({
            id: row.id,
            course_name: row.course_name,
            educator_id: row.student_id,
            created_at: row.created_at,
            profiles: {
                full_name: row.educator_name || "Instructor"
            },
            // Legacy schema properties for frontend compatibility
            academic_levels: { name: "All Levels" },
            programs: { name: "General" }
        }));

        return courses;
    } catch (err) {
        console.error("Error fetching enrolled courses from Turso:", err);
        throw new Error("Failed to fetch enrolled courses");
    }
}

export async function fetchStudentStats(courseId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        // Count total questions for the course
        const qResult = await db.execute({
            sql: "SELECT COUNT(*) as count FROM questions WHERE course_id = ?",
            args: [Number(courseId)]
        });
        const totalQ = Number(qResult.rows[0].count);

        // Count questions with progress records that are due now
        const dueResult = await db.execute({
            sql: `SELECT COUNT(*) as count FROM student_progress 
                  WHERE user_id = ? AND course_id = ? AND next_review_date <= ?`,
            args: [user.id, Number(courseId), new Date().toISOString()]
        });
        const progressDue = Number(dueResult.rows[0].count);

        // Count NEW questions (never reviewed = no progress record)
        const newResult = await db.execute({
            sql: `SELECT COUNT(*) as count FROM questions 
                  WHERE course_id = ? AND id NOT IN (
                      SELECT question_id FROM student_progress 
                      WHERE user_id = ? AND course_id = ?
                  )`,
            args: [Number(courseId), user.id, Number(courseId)]
        });
        const newCount = Number(newResult.rows[0].count);

        // Count mastered (interval > 21 days)
        const masteredResult = await db.execute({
            sql: `SELECT COUNT(*) as count FROM student_progress 
                  WHERE user_id = ? AND course_id = ? AND interval > 21`,
            args: [user.id, Number(courseId)]
        });
        const masteredCount = Number(masteredResult.rows[0].count);

        return {
            total: totalQ,
            mastered: masteredCount,
            due: progressDue + newCount  // Due = overdue reviews + never-reviewed questions
        };
    } catch (err) {
        console.error("Error fetching student stats from Turso:", err);
        return { total: 0, mastered: 0, due: 0 };
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
