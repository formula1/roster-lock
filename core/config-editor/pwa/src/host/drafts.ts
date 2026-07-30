import type { JSON_Unknown } from "@roster-lock/utils";

// Drafts live entirely in the browser (IndexedDB) - import/export moves
// them in and out as .rosterlock.draft.json files.

export type DraftRecord = {
  id: string,
  name: string,
  updatedAt: number,
  contents: JSON_Unknown,
};

export type DraftSummary = Omit<DraftRecord, "contents">;

const DB_NAME = "roster-lock-editor";
const STORE = "drafts";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject)=>{
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  try {
    return await new Promise<T>((resolve, reject)=>{
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function listDrafts(): Promise<Array<DraftSummary>> {
  const records = await withStore<DraftRecord[]>("readonly", (store) => store.getAll());
  return records
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDraft(id: string): Promise<DraftRecord | null> {
  const record = await withStore<DraftRecord | undefined>("readonly", (store) => store.get(id));
  return record ?? null;
}

export async function putDraft(record: DraftRecord): Promise<void> {
  await withStore("readwrite", (store) => store.put(record));
}

export async function deleteDraft(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export function newDraftId(){
  return crypto.randomUUID();
}
