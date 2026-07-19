
export type RosterPiece = {
  engine_name: string,
  piece_type: string,
  logic_hash: string,
  media_hash: string,
  path_variables: Record<string, string>,
  download_source: string,
  folder_name: string,
  status: "pending" | "complete" | "error",
  created_at: number,
  completed_at: number,
}


export type DownloadError = {
  id: number,
  engine_name: string,
  piece_type: string,
  logic_hash: string,
  media_hash: string,
  download_source: string,
  error_message: string,
  timestamp: number,
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS pieces (
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  media_hash TEXT NOT NULL,
  download_source TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'complete', 'error')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  path_variables TEXT,
  PRIMARY KEY (engine_name, piece_type, logic_hash, media_hash)
);

CREATE INDEX IF NOT EXISTS idx_status ON pieces(status);
CREATE INDEX IF NOT EXISTS idx_folder ON pieces(folder_name);

CREATE TABLE IF NOT EXISTS download_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  media_hash TEXT NOT NULL,
  download_source TEXT NOT NULL,
  error_message TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (engine_name, piece_type, logic_hash, media_hash) 
    REFERENCES pieces(engine_name, piece_type, logic_hash, media_hash)
);
`;

import { RosterLockV1Config } from "@roster-lock/types";
import { PieceInfo } from "./types";
import Database from "better-sqlite3";
export function prepareDatabase(dbLocation: string){
  const db = new Database(dbLocation);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  const statements = {
    getPiece: db.prepare(
      `
      SELECT * FROM pieces
      WHERE engine_name = @engineName
        AND piece_type = @pieceType
        AND logic_hash = @logic
        AND media_hash = @media
      `
    ),
    insertNewPiece: db.prepare(
      `INSERT INTO pieces (
        engine_name, piece_type, logic_hash, media_hash,
        path_variables,
        download_source,
        folder_name,
        status
      ) VALUES (
        @engineName, @pieceType, @logic, @media,
        @pathVariables,
        @downloadSource,
        @folderName,
        'pending'
      )`
    ),

    updateDownloadSource: db.prepare(
      `
      UPDATE pieces SET download_source = @downloadSource
      WHERE engine_name = @engineName
        AND piece_type = @pieceType
        AND logic_hash = @logic
        AND media_hash = @media
      `
    ),

    resetPieceStatus: db.prepare(
      `
      UPDATE pieces SET status = 'error' 
      WHERE engine_name = @engineName
        AND piece_type = @pieceType
        AND logic_hash = @logic
        AND media_hash = @media
      `
    ),
    pieceSuccessfullyDownloaded: db.prepare(
      `
      UPDATE pieces SET status = 'complete', completed_at = unixepoch()
      WHERE engine_name = @engineName
        AND piece_type = @pieceType
        AND logic_hash = @logic
        AND media_hash = @media
      `
    ),
    pieceFailedToDownload: db.prepare(
      `
      UPDATE pieces SET status = 'error'
      WHERE engine_name = @engineName
        AND piece_type = @pieceType
        AND logic_hash = @logic
        AND media_hash = @media
      `
    ),
    insertDownloadError: db.prepare(
      `INSERT INTO download_errors (
        engine_name, piece_type, logic_hash, media_hash,
        download_source, error_message
      ) VALUES (
        @engineName, @pieceType, @logic, @media,
        @downloadSource, @errorMessage
      )`
    ),
  };
  return {
    db,

    close(){
      db.close();
    },

    getPiece(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: { pieceType: string, logic: string, media: string }
    ){
      const item = statements.getPiece.get({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
      }) as Omit<RosterPiece, "path_variables"> & { path_variables: string };
      if(!item) return undefined;
      return {
        ...item,
        path_variables: JSON.parse(item.path_variables),
      };
    },

    insertNewPiece(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: PieceInfo,
      downloadSource: string,
      folderName: string,
    ){
      return statements.insertNewPiece.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
        pathVariables: JSON.stringify(pieceInfo.pathVariables),
        downloadSource,
        folderName,
      });
    },
    updateDownloadSource(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: PieceInfo,
      downloadSource: string,
    ){
      return statements.updateDownloadSource.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
        downloadSource,
      });
    },
    resetPieceStatus(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: { pieceType: string, logic: string, media: string }
    ){
      // Mark as error so we can retry
      statements.resetPieceStatus.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
      });
    },

    pieceSuccessfullyDownloaded(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: { pieceType: string, logic: string, media: string }
    ){
      return statements.pieceSuccessfullyDownloaded.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
      });
    },

    pieceFailedToDownload(
      engineConfig: RosterLockV1Config["engine"],
      pieceInfo: { pieceType: string, logic: string, media: string },
      downloadSource: string,
      error: string,
    ){
      statements.pieceFailedToDownload.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
      }
      );
      statements.insertDownloadError.run({
        engineName: engineConfig.name,
        pieceType: pieceInfo.pieceType,
        logic: pieceInfo.logic,
        media: pieceInfo.media,
        downloadSource,
        errorMessage: error,
      });
    },

    listPieces(
      engineName: string,
      pieceType: string,
      logicIds: Array<string>,
      { page, limit }: { page: number, limit: number }
    ){
      if(logicIds.length === 0) return [];
      const logicParams = logicIds.map((_, i)=>`@logic${i}`).join(", ");
      const stmt = db.prepare(
        `
        SELECT * FROM pieces
        WHERE engine_name = @engineName
          AND piece_type = @pieceType
          AND status = 'complete'
          AND logic_hash IN (${logicParams})
        ORDER BY completed_at ASC
        LIMIT @limit OFFSET @offset
        `
      );
      const params: Record<string, string | number> = {
        engineName,
        pieceType,
        limit,
        offset: page * limit,
      };
      logicIds.forEach((logicId, i)=>{ params[`logic${i}`] = logicId; });
      const items = stmt.all(params) as Array<
        Omit<RosterPiece, "path_variables"> & { path_variables: string }
      >;
      return items.map(item=>({
        ...item,
        path_variables: JSON.parse(item.path_variables),
      }));
    }
  }
}

