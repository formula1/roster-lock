
import { SQLite3FolderDB } from "./ensurePieceExists";
export { SQLite3FolderDB };

const dbCache = new Map<string, SQLite3FolderDB>();
export function getSQLite3FolderDB(folder: string){
  const existing = dbCache.get(folder);
  if(existing) return existing;
  const newDB = new SQLite3FolderDB(folder);
  dbCache.set(folder, newDB);
  return newDB;
}
