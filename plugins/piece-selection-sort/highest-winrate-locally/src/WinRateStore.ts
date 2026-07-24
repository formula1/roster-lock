import { DatabaseSync } from "node:sqlite";
import { join as pathJoin } from "node:path";

export type WinRateStore = {
  recordGame(engineName: string, pieceType: string, logicId: string): void,
  recordWin(engineName: string, pieceType: string, logicId: string): void,
  // Ranked best-winrate-first, breaking ties on games played (more data = more
  // confidence). Pieces with zero recorded games are excluded entirely.
  topRanked(engineName: string, pieceType: string): Array<string>,
  close(): void,
};

export function openWinRateStore(dataDir: string): WinRateStore {
  const db = new DatabaseSync(pathJoin(dataDir, "stats.sqlite3"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      engine_name TEXT NOT NULL,
      piece_type TEXT NOT NULL,
      logic_id TEXT NOT NULL,
      games INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (engine_name, piece_type, logic_id)
    );
  `);

  function ensureRow(engineName: string, pieceType: string, logicId: string){
    db.prepare(`
      INSERT INTO results (engine_name, piece_type, logic_id, games, wins)
      VALUES (@engineName, @pieceType, @logicId, 0, 0)
      ON CONFLICT (engine_name, piece_type, logic_id) DO NOTHING
    `).run({ engineName, pieceType, logicId });
  }

  return {
    recordGame(engineName, pieceType, logicId){
      ensureRow(engineName, pieceType, logicId);
      db.prepare(`
        UPDATE results SET games = games + 1
        WHERE engine_name = @engineName AND piece_type = @pieceType AND logic_id = @logicId
      `).run({ engineName, pieceType, logicId });
    },
    recordWin(engineName, pieceType, logicId){
      ensureRow(engineName, pieceType, logicId);
      db.prepare(`
        UPDATE results SET wins = wins + 1
        WHERE engine_name = @engineName AND piece_type = @pieceType AND logic_id = @logicId
      `).run({ engineName, pieceType, logicId });
    },
    topRanked(engineName, pieceType){
      const rows = db.prepare(`
        SELECT logic_id FROM results
        WHERE engine_name = @engineName AND piece_type = @pieceType AND games > 0
        ORDER BY (CAST(wins AS REAL) / games) DESC, games DESC
      `).all({ engineName, pieceType }) as Array<{ logic_id: string }>;
      return rows.map((row)=>row.logic_id);
    },
    close(){
      db.close();
    },
  };
}
