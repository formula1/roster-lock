
import { RosterLockV1Config } from "@roster-lock/types";
import { DatabaseSync } from "node:sqlite";

type RosterLockPiece = RosterLockV1Config["rosters"][string][number];
type StoredPiece = (
  & {
    engineName: string,
    pieceType: string,
  }
  & Pick<RosterLockPiece,  "version" | "humanInfo" | "pathVariables" | "downloadSources">
);
/*
type JSONType = {
  engineName: string,
  pieceType: string,
  version: {
    logic: string;
    media: string;
    docs: string;
  },
  humanInfo: {
    name: string;
    author: string;
    url: string;
    image?: string | undefined;
  },
  pathVariables: Record<string, string>,
  downloadSources: Array<string>
}
  */

type PieceIndex = {
  engineName: string,
  pieceType: string,
  logic: string,
  media: string
}

type HumanInfo = RosterLockPiece["humanInfo"];

export type PieceRow = {
  engine_name: string,
  piece_type: string,
  logic_hash: string,
  media_hash: string,
  docs_hash: string,
  human_info: HumanInfo,
  path_variables: Record<string, string>,
  folder_name: string,
  status: "pending" | "complete" | "error",
  created_at: number,
  completed_at: number | null,
}

// human_info and path_variables as they come off the wire - JSON text.
type PieceRowRaw = Omit<PieceRow, "human_info" | "path_variables"> & {
  human_info: string,
  path_variables: string,
};

export type DownloadSourceRow = {
  source: string,
  // unixepoch seconds; null = never tested
  last_test: number | null,
  success: 0 | 1 | null,
  error: string | null,
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS pieces (
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  media_hash TEXT NOT NULL,
  docs_hash TEXT NOT NULL,
  human_info TEXT NOT NULL,
  path_variables TEXT,
  folder_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'complete', 'error')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  PRIMARY KEY (engine_name, piece_type, logic_hash, media_hash)
);

CREATE INDEX IF NOT EXISTS idx_status ON pieces(status);
CREATE INDEX IF NOT EXISTS idx_folder ON pieces(folder_name);

CREATE TABLE IF NOT EXISTS download_sources (
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  media_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  last_test INTEGER,
  success INTEGER,
  error TEXT,
  PRIMARY KEY (engine_name, piece_type, logic_hash, media_hash, source),
  FOREIGN KEY (engine_name, piece_type, logic_hash, media_hash)
    REFERENCES pieces(engine_name, piece_type, logic_hash, media_hash)
);

CREATE TABLE IF NOT EXISTS media_overrides (
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  override_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  assets TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'complete', 'error')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  PRIMARY KEY (engine_name, piece_type, logic_hash, override_hash)
);

CREATE INDEX IF NOT EXISTS idx_media_override_status ON media_overrides(status);
CREATE INDEX IF NOT EXISTS idx_media_override_folder ON media_overrides(folder_name);

CREATE TABLE IF NOT EXISTS media_override_download_sources (
  engine_name TEXT NOT NULL,
  piece_type TEXT NOT NULL,
  logic_hash TEXT NOT NULL,
  override_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  last_test INTEGER,
  success INTEGER,
  error TEXT,
  PRIMARY KEY (engine_name, piece_type, logic_hash, override_hash, source),
  FOREIGN KEY (engine_name, piece_type, logic_hash, override_hash)
    REFERENCES media_overrides(engine_name, piece_type, logic_hash, override_hash)
);
`;

export type MediaOverrideIndex = {
  engineName: string,
  pieceType: string,
  logicHash: string,
  overrideHash: string,
}

export type MediaOverrideRow = {
  engine_name: string,
  piece_type: string,
  logic_hash: string,
  override_hash: string,
  name: string,
  assets: string,
  folder_name: string,
  status: "pending" | "complete" | "error",
  created_at: number,
  completed_at: number | null,
}

const MEDIA_OVERRIDE_WHERE = `
  WHERE engine_name = @engineName
    AND piece_type = @pieceType
    AND logic_hash = @logicHash
    AND override_hash = @overrideHash
`;

const PIECE_WHERE = `
  WHERE engine_name = @engineName
    AND piece_type = @pieceType
    AND logic_hash = @logic
    AND media_hash = @media
`;


function parsePieceRow(row: PieceRowRaw, sources: Array<DownloadSourceRow>): StoredPiece {
  return {
    engineName: row.engine_name,
    pieceType: row.piece_type,
    version: {
      logic: row.logic_hash,
      media: row.media_hash,
      docs: row.docs_hash
    },
    humanInfo: JSON.parse(row.human_info),
    pathVariables: JSON.parse(row.path_variables),
    downloadSources: sources.map(({ source })=>(source))
  };
}

export function prepareDatabase(dbLocation: string){
  const db = new DatabaseSync(dbLocation);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrateLegacyDatabase(db);
  return {
    db,

    close(){
      db.close();
    },

    getPiece(
      pieceInfo: PieceIndex
    ): undefined | StoredPiece {
      const item = db.prepare(
        `SELECT * FROM pieces ${PIECE_WHERE}`
      ).get(pieceInfo) as PieceRowRaw | undefined;
      if(!item) return undefined;
      const sources = db.prepare(
        `SELECT * FROM download_sources ${PIECE_WHERE}`
      ).all(pieceInfo) as Array<DownloadSourceRow>;
      return parsePieceRow(item, sources);
    },

    // Agent-side bookkeeping about a piece's download - the part of a row
    // that isn't config-shaped and so doesn't belong on StoredPiece.
    getPieceState(
      pieceInfo: PieceIndex
    ): undefined | {
      status: PieceRow["status"],
      folderName: string,
      // unixepoch seconds; null for rows that predate completion tracking
      completedAt: number | null,
    } {
      const item = db.prepare(
        `SELECT status, folder_name, completed_at FROM pieces ${PIECE_WHERE}`
      ).get(pieceInfo) as Pick<PieceRow, "status" | "folder_name" | "completed_at"> | undefined;
      if(!item) return undefined;
      return {
        status: item.status,
        folderName: item.folder_name,
        completedAt: item.completed_at,
      };
    },

    getDownloadSources(
      pieceInfo: PieceIndex
    ){
      return db.prepare(
        `
        SELECT source, last_test, success, error FROM download_sources
        ${PIECE_WHERE}
        ORDER BY rowid ASC
        `
      ).all(pieceInfo) as Array<DownloadSourceRow>;
    },

    // Batched form of getPieceState for a page of rows - one query instead
    // of one per piece. Keyed by "pieceType\x00logic\x00media".
    getPieceStatesFor(
      engineName: string,
      pieces: Array<{ pieceType: string, logic: string, media: string }>
    ): Map<string, { status: PieceRow["status"], folderName: string, completedAt: number | null }> {
      const result = new Map<string, { status: PieceRow["status"], folderName: string, completedAt: number | null }>();
      if(pieces.length === 0) return result;
      const values = pieces.map((_, i)=>`(@pieceType${i}, @logic${i}, @media${i})`).join(", ");
      const params: Record<string, string> = { engineName };
      pieces.forEach((piece, i)=>{
        params[`pieceType${i}`] = piece.pieceType;
        params[`logic${i}`] = piece.logic;
        params[`media${i}`] = piece.media;
      });
      const rows = db.prepare(
        `
        SELECT piece_type, logic_hash, media_hash, status, folder_name, completed_at
        FROM pieces
        WHERE engine_name = @engineName
          AND (piece_type, logic_hash, media_hash) IN (VALUES ${values})
        `
      ).all(params) as Array<
        Pick<PieceRow, "status" | "folder_name" | "completed_at">
        & { piece_type: string, logic_hash: string, media_hash: string }
      >;
      for(const row of rows){
        const key = `${row.piece_type}\x00${row.logic_hash}\x00${row.media_hash}`;
        result.set(key, {
          status: row.status, folderName: row.folder_name, completedAt: row.completed_at,
        });
      }
      return result;
    },

    // Batched form of getDownloadSources for a page of rows - one query
    // instead of one per piece. Keyed by "pieceType\x00logic\x00media" so
    // callers can group results back onto the piece they came from.
    getDownloadSourcesFor(
      engineName: string,
      pieces: Array<{ pieceType: string, logic: string, media: string }>
    ): Map<string, Array<DownloadSourceRow>> {
      const result = new Map<string, Array<DownloadSourceRow>>();
      if(pieces.length === 0) return result;
      const values = pieces.map((_, i)=>`(@pieceType${i}, @logic${i}, @media${i})`).join(", ");
      const params: Record<string, string> = { engineName };
      pieces.forEach((piece, i)=>{
        params[`pieceType${i}`] = piece.pieceType;
        params[`logic${i}`] = piece.logic;
        params[`media${i}`] = piece.media;
      });
      const rows = db.prepare(
        `
        SELECT piece_type, logic_hash, media_hash, source, last_test, success, error
        FROM download_sources
        WHERE engine_name = @engineName
          AND (piece_type, logic_hash, media_hash) IN (VALUES ${values})
        ORDER BY rowid ASC
        `
      ).all(params) as Array<DownloadSourceRow & {
        piece_type: string, logic_hash: string, media_hash: string
      }>;
      for(const row of rows){
        const key = `${row.piece_type}\x00${row.logic_hash}\x00${row.media_hash}`;
        const existing = result.get(key);
        if(existing) existing.push(row);
        else result.set(key, [row]);
      }
      return result;
    },

    insertNewPiece(
      piece: StoredPiece,
      folderName: string,
    ){
      const pieceInfo = {
        engineName: piece.engineName,
        pieceType: piece.pieceType,
        logic: piece.version.logic,
        media: piece.version.media
      };
      const result = db.prepare(
        `INSERT INTO pieces (
          engine_name, piece_type, logic_hash, media_hash,
          docs_hash,
          human_info,
          path_variables,
          folder_name,
          status
        ) VALUES (
          @engineName, @pieceType, @logic, @media,
          @docsHash,
          @humanInfo,
          @pathVariables,
          @folderName,
          'pending'
        )`
      ).run({
        ...pieceInfo,
        docsHash: piece.version.docs,
        humanInfo: JSON.stringify(piece.humanInfo),
        pathVariables: JSON.stringify(piece.pathVariables),
        folderName,
      });
      const insertSource = db.prepare(
        `INSERT OR IGNORE INTO download_sources (
          engine_name, piece_type, logic_hash, media_hash, source
        ) VALUES (@engineName, @pieceType, @logic, @media, @source)`
      );
      for(const source of piece.downloadSources){
        insertSource.run({ ...pieceInfo, source });
      }
      return result;
    },

    recordSourceTest(
      pieceInfo: PieceIndex,
      source: string,
      result: { success: boolean, error?: string },
    ){
      return db.prepare(
        `INSERT INTO download_sources (
          engine_name, piece_type, logic_hash, media_hash, source,
          last_test, success, error
        ) VALUES (
          @engineName, @pieceType, @logic, @media, @source,
          unixepoch(), @success, @error
        )
        ON CONFLICT (engine_name, piece_type, logic_hash, media_hash, source)
        DO UPDATE SET
          last_test = excluded.last_test,
          success = excluded.success,
          error = excluded.error`
      ).run({
        ...pieceInfo,
        source,
        success: result.success ? 1 : 0,
        error: result.error ?? null,
      });
    },

    resetPieceStatus(
      pieceInfo: PieceIndex
    ){
      // Mark as error so we can retry
      db.prepare(
        `UPDATE pieces SET status = 'error' ${PIECE_WHERE}`
      ).run(pieceInfo);
    },

    pieceSuccessfullyDownloaded(
      pieceInfo: PieceIndex,
      downloadSource: string,
    ){
      this.recordSourceTest(pieceInfo, downloadSource, { success: true });
      return db.prepare(
        `UPDATE pieces SET status = 'complete', completed_at = unixepoch() ${PIECE_WHERE}`
      ).run(pieceInfo);
    },

    pieceFailedToDownload(
      pieceInfo: PieceIndex,
      downloadSource: string,
      error: string,
    ){
      this.recordSourceTest(pieceInfo, downloadSource, { success: false, error });
      db.prepare(
        `UPDATE pieces SET status = 'error' ${PIECE_WHERE}`
      ).run(pieceInfo);
    },

    listPieces(
      engineName: string,
      pieceType: string,
      logicIds: Array<string>,
      { page, limit }: { page: number, limit: number }
    ): Array<StoredPiece>{
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
      const items = stmt.all(params) as Array<PieceRowRaw>;
      const sourcesByPiece = this.getDownloadSourcesFor(engineName, items.map((item)=>({
        pieceType: item.piece_type, logic: item.logic_hash, media: item.media_hash,
      })));
      return items.map((piece)=>{
        const key = `${piece.piece_type}\x00${piece.logic_hash}\x00${piece.media_hash}`;
        return parsePieceRow(piece, sourcesByPiece.get(key) ?? []);
      });
    },

    // Editor browsing of everything ever downloaded - unlike listPieces this
    // isn't scoped to a selection's logicIds. The text search covers human
    // info, logic hash, and download sources.
    searchPieces(
      { engineName, pieceType, search, page, limit }: {
        engineName: string,
        pieceType?: string,
        search?: string,
        page: number,
        limit: number,
      }
    ): { total: number, items: Array<StoredPiece> } {
      const where = `
        WHERE engine_name = @engineName
          AND status = 'complete'
          AND (@pieceType IS NULL OR piece_type = @pieceType)
          AND (
            @search IS NULL
            OR human_info LIKE '%' || @search || '%'
            OR logic_hash LIKE @search || '%'
            OR EXISTS (
              SELECT 1 FROM download_sources ds
              WHERE ds.engine_name = pieces.engine_name
                AND ds.piece_type = pieces.piece_type
                AND ds.logic_hash = pieces.logic_hash
                AND ds.media_hash = pieces.media_hash
                AND ds.source LIKE '%' || @search || '%'
            )
          )
      `;
      const params = {
        engineName,
        pieceType: pieceType ?? null,
        search: search || null,
      };
      const { total } = db.prepare(
        `SELECT COUNT(*) as total FROM pieces ${where}`
      ).get(params) as { total: number };
      const items = db.prepare(
        `SELECT * FROM pieces ${where}
        ORDER BY completed_at DESC
        LIMIT @limit OFFSET @offset`
      ).all({ ...params, limit, offset: page * limit }) as Array<PieceRowRaw>;
      const sourcesByPiece = this.getDownloadSourcesFor(engineName, items.map((item)=>({
        pieceType: item.piece_type, logic: item.logic_hash, media: item.media_hash,
      })));
      return {
        total,
        items: items.map((piece)=>{
          const key = `${piece.piece_type}\x00${piece.logic_hash}\x00${piece.media_hash}`;
          return parsePieceRow(piece, sourcesByPiece.get(key) ?? []);
        }),
      };
    },

    getMediaOverrideState(
      index: MediaOverrideIndex
    ): undefined | {
      status: MediaOverrideRow["status"],
      folderName: string,
      completedAt: number | null,
    } {
      const item = db.prepare(
        `SELECT status, folder_name, completed_at FROM media_overrides ${MEDIA_OVERRIDE_WHERE}`
      ).get(index) as Pick<MediaOverrideRow, "status" | "folder_name" | "completed_at"> | undefined;
      if(!item) return undefined;
      return {
        status: item.status,
        folderName: item.folder_name,
        completedAt: item.completed_at,
      };
    },

    insertNewMediaOverride(
      override: MediaOverrideIndex & { name: string, assets: Array<string>, downloadSources: Array<string> },
      folderName: string,
    ){
      const result = db.prepare(
        `INSERT INTO media_overrides (
          engine_name, piece_type, logic_hash, override_hash,
          name, assets, folder_name, status
        ) VALUES (
          @engineName, @pieceType, @logicHash, @overrideHash,
          @name, @assets, @folderName, 'pending'
        )`
      ).run({
        engineName: override.engineName,
        pieceType: override.pieceType,
        logicHash: override.logicHash,
        overrideHash: override.overrideHash,
        name: override.name,
        assets: JSON.stringify(override.assets),
        folderName,
      });
      const insertSource = db.prepare(
        `INSERT OR IGNORE INTO media_override_download_sources (
          engine_name, piece_type, logic_hash, override_hash, source
        ) VALUES (@engineName, @pieceType, @logicHash, @overrideHash, @source)`
      );
      for(const source of override.downloadSources){
        insertSource.run({
          engineName: override.engineName, pieceType: override.pieceType,
          logicHash: override.logicHash, overrideHash: override.overrideHash, source,
        });
      }
      return result;
    },

    recordMediaOverrideSourceTest(
      index: MediaOverrideIndex,
      source: string,
      result: { success: boolean, error?: string },
    ){
      return db.prepare(
        `INSERT INTO media_override_download_sources (
          engine_name, piece_type, logic_hash, override_hash, source,
          last_test, success, error
        ) VALUES (
          @engineName, @pieceType, @logicHash, @overrideHash, @source,
          unixepoch(), @success, @error
        )
        ON CONFLICT (engine_name, piece_type, logic_hash, override_hash, source)
        DO UPDATE SET
          last_test = excluded.last_test,
          success = excluded.success,
          error = excluded.error`
      ).run({
        ...index,
        source,
        success: result.success ? 1 : 0,
        error: result.error ?? null,
      });
    },

    resetMediaOverrideStatus(
      index: MediaOverrideIndex
    ){
      db.prepare(
        `UPDATE media_overrides SET status = 'error' ${MEDIA_OVERRIDE_WHERE}`
      ).run(index);
    },

    mediaOverrideSuccessfullyDownloaded(
      index: MediaOverrideIndex,
      downloadSource: string,
    ){
      this.recordMediaOverrideSourceTest(index, downloadSource, { success: true });
      return db.prepare(
        `UPDATE media_overrides SET status = 'complete', completed_at = unixepoch() ${MEDIA_OVERRIDE_WHERE}`
      ).run(index);
    },

    mediaOverrideFailedToDownload(
      index: MediaOverrideIndex,
      downloadSource: string,
      error: string,
    ){
      this.recordMediaOverrideSourceTest(index, downloadSource, { success: false, error });
      db.prepare(
        `UPDATE media_overrides SET status = 'error' ${MEDIA_OVERRIDE_WHERE}`
      ).run(index);
    },
  }
}

// Databases in the wild predate docs_hash/human_info/download_sources - they
// carry a single download_source column, a piece_json blob, and a
// download_errors log. Fold all of that into the new shape, then drop it.
function migrateLegacyDatabase(db: DatabaseSync){
  const pieceColumns = (db.prepare(
    "SELECT name FROM pragma_table_info('pieces')"
  ).all() as Array<{ name: string }>).map((column)=>column.name);
  const hasErrorsTable = !!db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'download_errors'"
  ).get();
  const needsMigration = (
    !pieceColumns.includes("docs_hash")
    || !pieceColumns.includes("human_info")
    || pieceColumns.includes("piece_json")
    || pieceColumns.includes("download_source")
    || hasErrorsTable
  );
  if(!needsMigration) return;

  db.exec("BEGIN");
  try {
    if(!pieceColumns.includes("docs_hash")){
      db.exec("ALTER TABLE pieces ADD COLUMN docs_hash TEXT NOT NULL DEFAULT ''");
    }
    if(!pieceColumns.includes("human_info")){
      db.exec(`ALTER TABLE pieces ADD COLUMN human_info TEXT NOT NULL DEFAULT '{"name":"","author":"","url":""}'`);
    }
    if(pieceColumns.includes("piece_json")){
      db.exec(`
        UPDATE pieces SET
          docs_hash = COALESCE(json_extract(piece_json, '$.version.docs'), docs_hash),
          human_info = COALESCE(json_extract(piece_json, '$.humanInfo'), human_info)
        WHERE piece_json IS NOT NULL;
      `);
      db.exec(`
        INSERT OR IGNORE INTO download_sources
          (engine_name, piece_type, logic_hash, media_hash, source)
        SELECT p.engine_name, p.piece_type, p.logic_hash, p.media_hash, je.value
        FROM pieces p, json_each(p.piece_json, '$.downloadSources') je
        WHERE p.piece_json IS NOT NULL;
      `);
      db.exec("ALTER TABLE pieces DROP COLUMN piece_json");
    }
    if(pieceColumns.includes("download_source")){
      db.exec(`
        INSERT OR IGNORE INTO download_sources
          (engine_name, piece_type, logic_hash, media_hash, source)
        SELECT engine_name, piece_type, logic_hash, media_hash, download_source
        FROM pieces WHERE download_source != '';
      `);
      // The source a completed row was fetched from is a passed test.
      db.exec(`
        UPDATE download_sources
        SET success = 1, last_test = COALESCE(p.completed_at, unixepoch())
        FROM pieces p
        WHERE p.status = 'complete'
          AND p.engine_name = download_sources.engine_name
          AND p.piece_type = download_sources.piece_type
          AND p.logic_hash = download_sources.logic_hash
          AND p.media_hash = download_sources.media_hash
          AND p.download_source = download_sources.source
          AND download_sources.success IS NULL;
      `);
      db.exec("ALTER TABLE pieces DROP COLUMN download_source");
    }
    if(hasErrorsTable){
      db.exec(`
        INSERT OR IGNORE INTO download_sources
          (engine_name, piece_type, logic_hash, media_hash, source)
        SELECT DISTINCT engine_name, piece_type, logic_hash, media_hash, download_source
        FROM download_errors;
      `);
      // Carry each source's most recent error over as its latest test, unless
      // a newer success already claimed the slot.
      db.exec(`
        UPDATE download_sources
        SET success = 0, last_test = e.timestamp, error = e.error_message
        FROM (
          SELECT *, ROW_NUMBER() OVER (
            PARTITION BY engine_name, piece_type, logic_hash, media_hash, download_source
            ORDER BY timestamp DESC
          ) AS rn FROM download_errors
        ) e
        WHERE e.rn = 1
          AND e.engine_name = download_sources.engine_name
          AND e.piece_type = download_sources.piece_type
          AND e.logic_hash = download_sources.logic_hash
          AND e.media_hash = download_sources.media_hash
          AND e.download_source = download_sources.source
          AND (download_sources.last_test IS NULL OR e.timestamp > download_sources.last_test);
      `);
      db.exec("DROP TABLE download_errors");
    }
    db.exec("COMMIT");
  }catch(e){
    db.exec("ROLLBACK");
    throw e;
  }
}
