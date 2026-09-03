import { Env } from "../types";

// Atomically claims the next count for `name` in a single UPSERT...RETURNING
// statement - D1's single-writer model serializes this against any
// concurrent reservation for the same name, so two registrations can never
// be handed the same `${name}#${count}` tag. See src/db/schema.sql.
export async function reserveDisplayNameTag(env: Env, name: string): Promise<string> {
  const key = name.toLowerCase();
  const row = await env.DB.prepare(
    `INSERT INTO display_name_counts (name, next_count) VALUES (?, 2)
     ON CONFLICT(name) DO UPDATE SET next_count = next_count + 1
     RETURNING next_count - 1 AS count`,
  ).bind(key).first<{ count: number }>();

  return `${name}#${row!.count}`;
}
