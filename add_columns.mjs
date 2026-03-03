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
