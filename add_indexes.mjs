// add_indexes.mjs
// Run: node add_indexes.mjs
// Adds performance indexes to reduce Turso row reads.

import { createClient } from "@libsql/client";
import fs from "fs";

const envStr = fs.readFileSync(".env.local", "utf8");
let dbUrl = "";
let dbAuthToken = "";

envStr.split("\n").forEach(line => {
    if (line.startsWith("TURSO_MASTER_DATABASE_URL=")) {
        dbUrl = line.split("=")[1].trim();
    }
    if (line.startsWith("TURSO_MASTER_AUTH_TOKEN=")) {
        dbAuthToken = line.split("=")[1].trim();
    }
});

const db = createClient({
    url: dbUrl || "file:master.db",
    authToken: dbAuthToken,
});

const indexes = [
    // student_progress: Most queried table
    'CREATE INDEX IF NOT EXISTS idx_sp_user_course ON student_progress(user_id, course_id)',
    'CREATE INDEX IF NOT EXISTS idx_sp_user_review_date ON student_progress(user_id, next_review_date)',
    'CREATE INDEX IF NOT EXISTS idx_sp_user_course_review ON student_progress(user_id, course_id, next_review_date)',
    'CREATE INDEX IF NOT EXISTS idx_sp_question_id ON student_progress(question_id)',
    // courses
    'CREATE INDEX IF NOT EXISTS idx_courses_student ON courses(student_id)',
    // learning_materials
    'CREATE INDEX IF NOT EXISTS idx_lm_course ON learning_materials(course_id)',
];

async function main() {
    console.log('Adding performance indexes to Turso...\n');

    for (const sql of indexes) {
        try {
            await db.execute(sql);
            const name = sql.match(/idx_\w+/)[0];
            console.log(`✅ ${name}`);
        } catch (err) {
            console.error(`❌ Failed:`, err.message);
        }
    }

    console.log('\nDone! Queries will now use index lookups instead of full table scans.');
}

main();
