import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// Applies every migrations/*.sql file not yet recorded in schema_migrations,
// in filename order, each inside its own transaction - so a failure partway
// through one file rolls that file back rather than leaving it half-applied
// and marked as done.
export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);
    const { rows } = await client.query<{ name: string }>(`SELECT name FROM schema_migrations`);
    const applied = new Set(rows.map((row) => row.name));

    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)`,
          [file, new Date().toISOString()]
        );
        await client.query("COMMIT");
        console.log(`Applied migration ${file}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
  }
}
