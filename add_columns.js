import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.TURSO_MASTER_DATABASE_URL;
const dbAuthToken = process.env.TURSO_MASTER_AUTH_TOKEN;

const db = createClient({
    url: dbUrl || "file:master.db",
    authToken: dbAuthToken,
});

async function main() {
    try {
        await db.execute("ALTER TABLE profiles ADD COLUMN academic_level_id TEXT;");
        console.log("Added academic_level_id column.");
    } catch (e) {
        console.log("Column academic_level_id might already exist.", e.message);
    }
    try {
        await db.execute("ALTER TABLE profiles ADD COLUMN program_id TEXT;");
        console.log("Added program_id column.");
    } catch (e) {
        console.log("Column program_id might already exist.", e.message);
    }
    console.log("Done.");
}

main();
