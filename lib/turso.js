import { createClient } from "@libsql/client";

// The Database Configuration
const dbUrl = process.env.TURSO_MASTER_DATABASE_URL;
const dbAuthToken = process.env.TURSO_MASTER_AUTH_TOKEN;

if (!dbUrl) {
    console.warn("TURSO_MASTER_DATABASE_URL is not set.");
}

export const db = createClient({
    url: dbUrl || "file:master.db",
    authToken: dbAuthToken,
});

let dbInitialized = false;

export async function getDbClient() {
    if (!dbInitialized) {
        try {
            await db.executeMultiple(`
                CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, academic_level_id TEXT, program_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, student_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS learning_materials (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, file_name TEXT NOT NULL, file_path TEXT NOT NULL, topic_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, material_id INTEGER, question_text TEXT NOT NULL, choices TEXT NOT NULL, correct_answer TEXT NOT NULL, bloom_level TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS student_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, course_id INTEGER NOT NULL, question_id INTEGER NOT NULL, interval INTEGER DEFAULT 0, ease_factor REAL DEFAULT 2.5, next_review_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, question_id));
                CREATE INDEX IF NOT EXISTS idx_q_course ON questions(course_id);
                CREATE INDEX IF NOT EXISTS idx_q_material ON questions(material_id);
                CREATE INDEX IF NOT EXISTS idx_sp_user_course ON student_progress(user_id, course_id);
                CREATE INDEX IF NOT EXISTS idx_sp_user_review ON student_progress(user_id, next_review_date);
                CREATE INDEX IF NOT EXISTS idx_sp_user_course_review ON student_progress(user_id, course_id, next_review_date);
                CREATE INDEX IF NOT EXISTS idx_sp_question ON student_progress(question_id);
                CREATE INDEX IF NOT EXISTS idx_courses_student ON courses(student_id);
                CREATE INDEX IF NOT EXISTS idx_lm_course ON learning_materials(course_id);
            `);
            dbInitialized = true;
        } catch (err) {
            console.error("DB Initialization Warning:", err);
        }
    }
    return db;
}
