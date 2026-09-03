import { Pool } from "pg";
import { getDatabaseSsl, getDatabaseUrl } from "../../globals";

export function createPostgresPool(): Pool {
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error("MODELS_VERSION=postgres requires DATABASE_URL to be set");
  const pool = new Pool({ connectionString, ssl: getDatabaseSsl() ? true : undefined });
  // pg emits "error" for a backend connection that dies while idle in the
  // pool (network blip, provider-side restart) - without a listener, node
  // treats it as unhandled and crashes the process, which a transient
  // hiccup shouldn't do.
  pool.on("error", (error) => console.error("Postgres pool error", error));
  return pool;
}
