'use server';

import { createClient } from '@/utils/supabase/server';
import { getDbClient } from '@/lib/turso';

export async function saveTursoProfile(profileData) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new Error("Unauthorized");
    }

    try {
        const db = await getDbClient();
        const { full_name, email, academic_level_id, program_id } = profileData;

        // Upsert the profile into Turso 
        // SQLite upsert syntax: INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...
        await db.execute({
            sql: `
                INSERT INTO profiles (id, full_name, email, academic_level_id, program_id) 
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    full_name = excluded.full_name,
                    academic_level_id = excluded.academic_level_id,
                    program_id = excluded.program_id
            `,
            args: [user.id, full_name, email, academic_level_id, program_id]
        });

        return { success: true };
    } catch (err) {
        console.error("Error saving profile to Turso:", err);
        throw new Error("Failed to save profile");
    }
}

export async function getTursoProfile() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error("getTursoProfile: Unauthorized or no user found.", error);
        return null;
    }

    try {
        const db = await getDbClient();
        const result = await db.execute({
            sql: "SELECT * FROM profiles WHERE id = ?",
            args: [user.id]
        });

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            academic_level_id: row.academic_level_id,
            program_id: row.program_id,
            created_at: row.created_at
        };
    } catch (err) {
        console.error("Error fetching profile from Turso:", err);
        throw new Error("Failed to fetch profile");
    }
}
