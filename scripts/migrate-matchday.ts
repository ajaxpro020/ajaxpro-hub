import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL ontbreekt");
const migration = new URL("../db/migrations/005_matchday_live.sql", import.meta.url);

const main = async () => {
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql.unsafe(readFileSync(migration, "utf8"));
    console.log("Migratie 005_matchday_live.sql voltooid.");
  } finally {
    await sql.end();
  }
};

main().catch(error => {
  console.error("Migratie 005 mislukt.");
  throw error;
});
