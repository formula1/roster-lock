// A hand-rolled fake good enough for exactly the queries src/db/index.ts
// issues (insert-or-update-by-id, delete-by-id, select-with-optional-title-
// filter) - not a real SQL engine. No miniflare/vitest-pool-workers is wired
// up in this package yet, so this is the cheapest way to unit-test the room
// index's query logic without one.
export class FakeD1Database {
  rows = new Map<string, Record<string, unknown>>();

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  private args: Array<unknown> = [];
  constructor(private db: FakeD1Database, private sql: string) {}

  bind(...args: Array<unknown>) {
    this.args = args;
    return this;
  }

  async run() {
    if (this.sql.includes("INSERT INTO rooms")) {
      const [
        id, title, host_user_id, game_runner_plugin, roster_config_hash,
        status, max_players, min_players, participant_count, created_at,
      ] = this.args;
      const existing = this.db.rows.get(id as string);
      if (existing) {
        existing.status = status;
        existing.participant_count = participant_count;
      } else {
        this.db.rows.set(id as string, {
          id, title, host_user_id, game_runner_plugin, roster_config_hash,
          status, max_players, min_players, participant_count, created_at,
        });
      }
      return { success: true };
    }
    if (this.sql.includes("DELETE FROM rooms")) {
      this.db.rows.delete(this.args[0] as string);
      return { success: true };
    }
    throw new Error(`FakeD1Database: unsupported run() query: ${this.sql}`);
  }

  async all<T>() {
    if (!this.sql.includes("SELECT * FROM rooms")) {
      throw new Error(`FakeD1Database: unsupported all() query: ${this.sql}`);
    }
    let results = [...this.db.rows.values()].filter((r) => r.status === "waiting");
    if (this.sql.includes("LIKE")) {
      const pattern = String(this.args[0]).replace(/^%|%$/g, "").toLowerCase();
      results = results.filter((r) => String(r.title).toLowerCase().includes(pattern));
    }
    results.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { results: results as Array<T> };
  }
}
