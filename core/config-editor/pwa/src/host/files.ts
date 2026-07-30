import type { WalkEntry, WalkedFolder, PickedFile } from "@roster-lock/config-editor-gui";

// Folder access (and re-readable file references) come from the File System
// Access API, which only Chromium implements - the host exposes them as the
// gui's optional walkDir/folderExists/loadFile capabilities, and on other
// browsers leaves them undefined so the UI disables those features.
//
// Picked handles persist in IndexedDB keyed by host-minted tokens, so
// tokens survive reloads. Read permission is per-session in a normal tab:
// reusing a stored handle re-prompts once (a one-click re-grant, no picker),
// and installed PWAs on Chrome 122+ can grant it permanently.

type PermissionState = "granted" | "denied" | "prompt";
type PermissionQueryable = {
  queryPermission?: (options: { mode: "read" }) => Promise<PermissionState>,
  requestPermission?: (options: { mode: "read" }) => Promise<PermissionState>,
};
type FsaFileHandle = PermissionQueryable & {
  kind: "file",
  name: string,
  getFile: () => Promise<File>,
};
type FsaDirectoryHandle = PermissionQueryable & {
  kind: "directory",
  name: string,
  entries: () => AsyncIterable<[string, FsaFileHandle | FsaDirectoryHandle]>,
  getDirectoryHandle: (name: string) => Promise<FsaDirectoryHandle>,
  getFileHandle: (name: string) => Promise<FsaFileHandle>,
};

const fsaWindow = window as {
  showDirectoryPicker?: (options?: { id?: string }) => Promise<FsaDirectoryHandle>,
  showOpenFilePicker?: (options?: { id?: string }) => Promise<Array<FsaFileHandle>>,
};

export const supportsFolderAccess = typeof fsaWindow.showDirectoryPicker === "function";

function randomId(){
  return Math.random().toString(32).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Handle store - IndexedDB because FileSystemHandles are structured-cloneable
// but not JSON-serializable.

const DB_NAME = "roster-lock-editor-handles";
const STORE = "handles";

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject)=>{
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function handleStoreGet(token: string): Promise<unknown> {
  const db = await openHandleDb();
  try {
    return await new Promise((resolve, reject)=>{
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(token);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function handleStoreSet(token: string, handle: unknown): Promise<void> {
  const db = await openHandleDb();
  try {
    await new Promise<void>((resolve, reject)=>{
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(handle, token);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Re-grant needs a user gesture; without one requestPermission throws and
// the caller's error state surfaces it - a later click-driven retry works.
async function ensureReadPermission(handle: PermissionQueryable, description: string){
  if(!handle.queryPermission || !handle.requestPermission) return;
  if(await handle.queryPermission({ mode: "read" }) === "granted") return;
  if(await handle.requestPermission({ mode: "read" }) !== "granted"){
    throw new Error("Read permission was not granted for " + description);
  }
}

async function resolveDirHandle(folderToken: string): Promise<FsaDirectoryHandle> {
  const handle = await handleStoreGet(folderToken) as FsaDirectoryHandle | undefined;
  if(!handle || handle.kind !== "directory") throw new Error(
    "Folder is no longer available - re-pick: " + folderToken
  );
  await ensureReadPermission(handle, folderToken);
  return handle;
}

// ---------------------------------------------------------------------------
// Folder walking

async function* walkHandleEntries(
  folderToken: string, dir: FsaDirectoryHandle, prefix: string
): AsyncGenerator<WalkEntry> {
  for await (const [name, child] of dir.entries()){
    const relativePath = prefix ? `${prefix}/${name}` : name;
    if(child.kind === "directory"){
      yield* walkHandleEntries(folderToken, child, relativePath);
    } else {
      const file = await child.getFile();
      yield {
        relativePath,
        // Resolvable later through loadFile() by traversing from the stored
        // folder handle - no per-file handle storage needed.
        fileToken: `${folderToken}/${relativePath}`,
        size: file.size,
        loadFile: () => streamFile(file),
      };
    }
  }
}

export async function walkDir(folderToken?: string): Promise<null | WalkedFolder> {
  let token = folderToken;
  let handle: FsaDirectoryHandle;
  if(token){
    handle = await resolveDirHandle(token);
  } else {
    if(!fsaWindow.showDirectoryPicker) throw new Error("This browser cannot open folders");
    try {
      handle = await fsaWindow.showDirectoryPicker({ id: "roster-lock-editor" });
    }catch(e){
      if(e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    token = `dir:${handle.name}#${randomId()}`;
    await handleStoreSet(token, handle);
  }
  const walkedToken = token;
  const walkedHandle = handle;
  return {
    folderToken: walkedToken,
    // Fresh generator per iteration so the same WalkedFolder can be walked
    // more than once.
    entries: { [Symbol.asyncIterator]: () => walkHandleEntries(walkedToken, walkedHandle, "") },
  };
}

export async function folderExists(folderToken: string): Promise<boolean> {
  try {
    const handle = await handleStoreGet(folderToken) as FsaDirectoryHandle | undefined;
    if(!handle || handle.kind !== "directory") return false;
    // "prompt" still counts as present - a later click-driven walk will ask.
    if(handle.queryPermission && await handle.queryPermission({ mode: "read" }) === "denied"){
      return false;
    }
    return true;
  }catch(e){
    return false;
  }
}

export function loadFile(fileToken: string): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]: async function*(){
      const file = await resolveFileToken(fileToken);
      yield* streamFile(file);
    },
  };
}

async function resolveFileToken(fileToken: string): Promise<File> {
  if(fileToken.startsWith("file:")){
    const handle = await handleStoreGet(fileToken) as FsaFileHandle | undefined;
    if(!handle || handle.kind !== "file") throw new Error(
      "File is no longer available - re-pick: " + fileToken
    );
    await ensureReadPermission(handle, fileToken);
    return handle.getFile();
  }
  // Folder-entry token: `${folderToken}/${relativePath}` - traverse from the
  // stored folder handle (folder handle names never contain a slash).
  const slash = fileToken.indexOf("/");
  if(slash === -1) throw new Error("Unknown file token: " + fileToken);
  const dirHandle = await resolveDirHandle(fileToken.slice(0, slash));
  const segments = fileToken.slice(slash + 1).split("/");
  let dir = dirHandle;
  for(const segment of segments.slice(0, -1)){
    dir = await dir.getDirectoryHandle(segment);
  }
  const handle = await dir.getFileHandle(segments[segments.length - 1]);
  return handle.getFile();
}

// ---------------------------------------------------------------------------
// Single-file picking - FSA when available (mints a re-readable token),
// otherwise an <input type=file> one-shot read.

export async function pickHostFile(): Promise<null | PickedFile> {
  if(fsaWindow.showOpenFilePicker){
    let handle: FsaFileHandle;
    try {
      [handle] = await fsaWindow.showOpenFilePicker({ id: "roster-lock-editor" });
    }catch(e){
      if(e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    const token = `file:${handle.name}#${randomId()}`;
    await handleStoreSet(token, handle);
    const file = await handle.getFile();
    return {
      name: file.name,
      size: file.size,
      fileToken: token,
      loadFile: () => streamFile(file),
    };
  }

  const file = await pickSingleFile();
  if(!file) return null;
  return {
    name: file.name,
    size: file.size,
    loadFile: () => streamFile(file),
  };
}

export function pickSingleFile(): Promise<File | null> {
  return new Promise((resolve)=>{
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function* streamFile(file: File): AsyncIterable<Uint8Array> {
  // ReadableStream async iteration is still patchy across browsers - read
  // through a reader instead.
  const reader = file.stream().getReader();
  try {
    while(true){
      const { done, value } = await reader.read();
      if(done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function downloadFile(filename: string, data: Uint8Array | string, mimeType = "application/octet-stream"){
  const blob = new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Give the click a beat before revoking so the download starts reliably.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
