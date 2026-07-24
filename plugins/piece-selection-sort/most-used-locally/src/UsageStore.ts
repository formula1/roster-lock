import { DatabaseSync } from "node:sqlite";
import { join as pathJoin } from "node:path";

export type UsageStore = {
  increment(engineName: string, pieceType: string, logicId: string): void,
  topRanked(engineName: string, pieceType: string): Array<string>,
  close(): void,
};

export function openUsageStore(dataDir: string): UsageStore {
  const db = new DatabaseSync(pathJoin(dataDir, "stats.sqlite3"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      engine_name TEXT NOT NULL,
      piece_type TEXT NOT NULL,
      logic_id TEXT NOT NULL,
      times_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (engine_name, piece_type, logic_id)
    );
  `);

  return {
    increment(engineName, pieceType, logicId){
      db.prepare(`
        INSERT INTO usage (engine_name, piece_type, logic_id, times_used)
        VALUES (@engineName, @pieceType, @logicId, 1)
        ON CONFLICT (engine_name, piece_type, logic_id)
        DO UPDATE SET times_used = times_used + 1
      `).run({ engineName, pieceType, logicId });
    },
    topRanked(engineName, pieceType){
      const rows = db.prepare(`
        SELECT logic_id FROM usage
        WHERE engine_name = @engineName AND piece_type = @pieceType
        ORDER BY times_used DESC
      `).all({ engineName, pieceType }) as Array<{ logic_id: string }>;
      return rows.map((row)=>row.logic_id);
    },
    close(){
      db.close();
    },
  };
}
