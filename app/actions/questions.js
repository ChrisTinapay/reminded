'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

export async function saveQuestion(questionData) {
    // 1. Verify user using Supabase Auth
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const {
            course_id,
            material_id,
            question_text,
            choices,
            correct_answer,
            bloom_level
        } = questionData;

        // Shuffle choices so correct answer isn't always first
        const shuffled = [...choices];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const db = await getDbClient();

        const result = await db.execute({
            sql: `INSERT INTO questions 
                  (course_id, material_id, question_text, choices, correct_answer, bloom_level) 
                  VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            args: [
                course_id,
                material_id || null,
                question_text,
                JSON.stringify(shuffled), // Store shuffled choices
                correct_answer,
                bloom_level || null
            ]
        });

        return { success: true, id: result.rows[0].id };
    } catch (err) {
        console.error("Error saving question to Turso:", err);
        throw new Error("Failed to save question");
    }
}

export async function fetchQuestions(courseId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: "SELECT * FROM questions WHERE course_id = ? ORDER BY created_at DESC",
            args: [Number(courseId)]
        });

        const questions = result.rows.map(row => {
            const parsedChoices = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
            const trimmedChoices = Array.isArray(parsedChoices) ? parsedChoices.map(c => typeof c === 'string' ? c.trim() : c) : parsedChoices;
            const correctAnswer = typeof row.correct_answer === 'string' ? row.correct_answer.trim() : row.correct_answer;

            return {
                id: row.id,
                material_id: row.material_id,
                question_text: row.question_text,
                choices: trimmedChoices,
                correct_answer: correctAnswer,
                bloom_level: row.bloom_level,
                ease_factor: row.ease_factor,
                interval: row.interval,
                repetitions: row.repetitions,
                next_review_date: row.next_review_date
            };
        });

        return questions;

    } catch (err) {
        console.error("Error fetching questions from Turso:", err);
        throw new Error("Failed to fetch questions");
    }
}

export async function fetchQuestionsByMaterial(materialId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        const result = await db.execute({
            sql: "SELECT * FROM questions WHERE material_id = ? ORDER BY created_at DESC",
            args: [Number(materialId)]
        });

        return result.rows.map(row => {
            const parsedChoices = typeof row.choices === 'string' ? JSON.parse(row.choices) : row.choices;
            const trimmedChoices = Array.isArray(parsedChoices) ? parsedChoices.map(c => typeof c === 'string' ? c.trim() : c) : parsedChoices;
            const correctAnswer = typeof row.correct_answer === 'string' ? row.correct_answer.trim() : row.correct_answer;

            return {
                id: row.id,
                material_id: row.material_id,
                question_text: row.question_text,
                choices: trimmedChoices,
                correct_answer: correctAnswer,
                bloom_level: row.bloom_level,
            };
        });
    } catch (err) {
        console.error("Error fetching questions by material:", err);
        throw new Error("Failed to fetch questions");
    }
}

export async function updateQuestion(questionToSave) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        await db.execute({
            sql: `UPDATE questions 
                  SET question_text = ?, choices = ?, correct_answer = ?, bloom_level = ?
                  WHERE id = ?`,
            args: [
                questionToSave.question_text,
                JSON.stringify(questionToSave.choices),
                questionToSave.correct_answer,
                questionToSave.bloom_level,
                questionToSave.id
            ]
        });
        return { success: true };
    } catch (err) {
        console.error("Error updating question in Turso:", err);
        throw new Error("Failed to update question");
    }
}

export async function deleteQuestion(questionId) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) throw new Error("Unauthorized");

    try {
        const db = await getDbClient();

        await db.execute({
            sql: `DELETE FROM questions WHERE id = ?`,
            args: [questionId]
        });
        return { success: true };
    } catch (err) {
        console.error("Error deleting question in Turso:", err);
        throw new Error("Failed to delete question");
    }
}
