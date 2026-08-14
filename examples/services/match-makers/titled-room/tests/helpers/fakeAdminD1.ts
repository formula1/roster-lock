// A hand-rolled fake covering exactly the queries admin/index.ts,
// admin/jwt.ts, admin/game-runners.ts and game-runners.ts issue against the
// `admins` and `game_runner_configs` tables - not a real SQL engine, the
// same spirit as helpers/fakeD1.ts (which covers `rooms` only).
export class FakeAdminD1 {
  admins = new Map<string, Record<string, unknown>>();
  gameRunnerConfigs = new Map<string, Record<string, unknown>>();

  prepare(sql: string) {
    return new FakeAdminStatement(this, sql);
  }
}

class FakeAdminStatement {
  private args: Array<unknown> = [];
  constructor(private db: FakeAdminD1, private sql: string) {}

  bind(...args: Array<unknown>) {
    this.args = args;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM admins")) {
      const [username] = this.args as [string];
      return (this.db.admins.get(username) as T) ?? null;
    }
    if (this.sql.includes("FROM game_runner_configs")) {
      const [pluginName] = this.args as [string];
      return (this.db.gameRunnerConfigs.get(pluginName) as T) ?? null;
    }
    throw new Error(`FakeAdminD1: unsupported first() query: ${this.sql}`);
  }

  async run() {
    if (this.sql.includes("INSERT INTO admins")) {
      const [id, username, password_hash, password_expires_at, created_at] = this.args;
      this.db.admins.set(username as string, { id, username, password_hash, password_expires_at, created_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO game_runner_configs")) {
      const [plugin_name, engine_sha, coordinator_id, coordinator_host, coordinator_port, updated_at] = this.args;
      this.db.gameRunnerConfigs.set(plugin_name as string, {
        plugin_name, engine_sha, coordinator_id, coordinator_host, coordinator_port, updated_at,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM game_runner_configs")) {
      const [pluginName] = this.args as [string];
      const existed = this.db.gameRunnerConfigs.delete(pluginName);
      return { success: true, meta: { changes: existed ? 1 : 0 } };
    }
    throw new Error(`FakeAdminD1: unsupported run() query: ${this.sql}`);
  }

  async all<T>() {
    if (this.sql.includes("FROM game_runner_configs")) {
      return { results: [...this.db.gameRunnerConfigs.values()] as Array<T> };
    }
    throw new Error(`FakeAdminD1: unsupported all() query: ${this.sql}`);
  }
}
