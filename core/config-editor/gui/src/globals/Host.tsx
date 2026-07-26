import { createContext, useContext, type PropsWithChildren } from "react";
import type { JSON_Unknown } from "@roster-lock/utils";

// A file inside a walked folder. `fileToken` is an opaque, persistable
// reference minted by the host (an absolute path on Tauri, a stored-handle
// key on a PWA, ...) - pass it back to host.loadFile() to re-read the file
// later. `relativePath` is only meaningful within the walked folder and is
// what asset patterns match against.
export type WalkEntry = {
  relativePath: string,
  fileToken: string,
  size: number,
  loadFile: () => AsyncIterable<Uint8Array>,
};

// Files only - hosts don't yield directory entries. Iterating more than once
// re-walks the folder.
export type WalkDir = AsyncIterable<WalkEntry>;

export type WalkedFolder = {
  // Opaque, persistable reference to the folder (absolute path on Tauri, a
  // stored-handle key on a PWA, ...). Pass it back to walkDir() to re-walk
  // without prompting the user again.
  folderToken: string,
  entries: WalkDir,
};


// Shown wherever folder-dependent features are disabled, so users know
// which hosts do support them rather than just seeing a dead button.
export const FOLDER_ACCESS_HINT =
  "This host cannot open folders. The desktop app fully supports folder access; " +
  "Chromium browsers like Chrome have limited support (permission re-prompts after a reload).";

// A single picked file. `loadFile` streams the picked content; `fileToken`
// is only present when the host can resolve the file again later through
// host.loadFile() - hosts where a pick is a one-shot read leave it out.
export type PickedFile = {
  name: string,
  size: number,
  fileToken?: string,
  loadFile: () => AsyncIterable<Uint8Array>,
};

// Capabilities the host (Tauri app, PWA, ...) provides that have nothing to
// do with the current draft - unlike ConfigSource, these are known upfront
// at render time, so they're passed in directly rather than set later.
//
// The gui never sees real filesystem paths - only host-minted tokens. Any
// "which folder/file" decisions (dialogs, default directories, remembering
// the last location) live behind these functions.
export type HostFunctions = {
  // Opens a URL via whatever mechanism fits the host (system browser via
  // Tauri's shell plugin, a new tab in the PWA, ...) - link clicks inside
  // markdown shouldn't assume `open()`/`window.open()` behave the same way.
  openUrl: (url: string) => void,

  // Folder access is optional: Tauri always has it, the PWA only where the
  // File System Access API exists (Chromium). When these are undefined the
  // UI disables its "from folder" features.
  //
  // walkDir: without a folderToken, the host prompts the user to pick a
  // folder and resolves null if they cancel. With one (from an earlier walk,
  // possibly persisted), the host re-walks it without prompting - and throws
  // if the token no longer resolves.
  walkDir?: (folderToken?: string, options?: { title?: string }) => Promise<null | WalkedFolder>,
  folderExists?: (folderToken: string) => Promise<boolean>,
  // Re-reads a persisted fileToken (from an earlier pickFile or walk).
  loadFile?: (fileToken: string) => AsyncIterable<Uint8Array>,

  // Prompts the user to pick a single file; null if they cancel.
  pickFile: (options?: { title?: string }) => Promise<null | PickedFile>,

  // Host decides how "save a file" looks (native save dialog on Tauri, a
  // download on the PWA, ...). Resolves false if the user cancels.
  saveFile: (options: {
    suggestedName: string,
    data: Uint8Array,
    title?: string,
    filters?: Array<{ name: string, extensions: Array<string> }>,
  }) => Promise<boolean>,

  // Small persisted key-value store for UI conveniences (recent folders,
  // ...). Tauri backs this with its json storage, a PWA with localStorage.
  storage: {
    get: (key: string) => Promise<JSON_Unknown | null>,
    set: (key: string, value: JSON_Unknown) => Promise<void>,
    remove: (key: string) => Promise<void>,
  },
};

const HostContext = createContext<HostFunctions | null>(null);

export function useHost(){
  const host = useContext(HostContext);
  if(!host) throw new Error("useHost() called outside of a HostProvider");
  return host;
}

export function HostProvider(props: PropsWithChildren<{ host: HostFunctions }>){
  return (
    <HostContext.Provider value={props.host}>
      {props.children}
    </HostContext.Provider>
  );
}
