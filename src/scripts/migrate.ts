import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getPool, closePool } from "../config/database.js";

const migrationNamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;

async function migrate(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const migrationsDirectory = path.resolve(process.cwd(), "database", "migrations");

  try {
    await client.query("SELECT pg_advisory_lock($1)", [7_304_017]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await fs.readdir(migrationsDirectory)).filter((file) => migrationNamePattern.test(file)).sort();
    for (const file of files) {
      const existing = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (existing.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        // Migration SQL is trusted, version-controlled application code; user input is never interpolated here.
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("Database migrations are up to date.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [7_304_017]).catch(() => undefined);
    client.release();
    await closePool();
  }
}

migrate().catch(() => {
  console.error("Migration failed. Verify the database configuration and try again.");
  process.exitCode = 1;
});
