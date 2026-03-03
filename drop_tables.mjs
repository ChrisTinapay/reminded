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
        await db.execute("DROP TABLE IF EXISTS users;");
        console.log("Dropped table users.");
    } catch (e) {
        console.log("Could not drop table users.", e.message);
    }
    try {
        await db.execute("DROP TABLE IF EXISTS shards;");
        console.log("Dropped table shards.");
    } catch (e) {
        console.log("Could not drop table shards.", e.message);
    }
    console.log("Done.");
}

main();
