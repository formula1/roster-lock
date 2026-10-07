import { RefObject, useEffect, useState } from "react";
import { useMatchAgent } from "../context/MatchAgentContext";
import { useGlobalNav, FileDialogState } from "../context/GlobalNavContext";
import { listDirectory, DirectoryListing } from "../api/matchAgent";
import { backHint } from "../utils/inputLabels";

// A file picker rendered in the page itself - every row is a plain
// <button>, so it's reachable through the exact same Move/Select/Back
// scheme (GlobalNavContext) as everything else in the shell, unlike a
// native OS file dialog (pick-file.ts/api/matchAgent's
// pickRosterLockFile), which is a window outside the browser entirely and
// so has no way for a gamepad to reach it at all. Opened via
// useGlobalNav().pickFile(...), not mounted directly by callers.
export function OnScreenFileDialog({ containerRef, state }: {
  containerRef: RefObject<HTMLDivElement | null>,
  state: FileDialogState | null,
}) {
  const { settings } = useMatchAgent();
  const { inputDevice, keyboardBindings, gamepadBindings } = useGlobalNav();
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resets to the dialog's own starting folder each time it's (re)opened,
  // rather than wherever a previous use of it left off.
  useEffect(() => {
    setCurrentPath(state?.startPath);
    setListing(null);
    setError(null);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    listDirectory(settings.url, settings.authCode, currentPath, state.extension)
      .then((result) => { if (!cancelled) setListing(result); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currentPath, settings.url, settings.authCode]);

  // Re-focuses the first row once a (new) folder's listing actually
  // renders - GlobalNavContext's own open-focus effect only fires when the
  // dialog first opens, since it has no visibility into which folder is
  // currently showing (that state lives here, not there).
  useEffect(() => {
    if (listing) containerRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [listing, containerRef]);

  if (!state) return null;

  return (
    <div className="onscreen-keyboard-backdrop">
      <div className="onscreen-file-dialog" ref={containerRef}>
        <div className="onscreen-file-dialog-path">{listing?.path ?? currentPath ?? "Loading..."}</div>
        {error && <p className="error">{error}</p>}
        <div className="onscreen-file-dialog-list">
          {listing?.parent !== null && listing && (
            <button type="button" onClick={() => setCurrentPath(listing.parent!)}>.. (up a folder)</button>
          )}
          {listing?.entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              data-directory={entry.isDirectory}
              onClick={() => (entry.isDirectory ? setCurrentPath(entry.path) : state.resolve(entry.path))}
            >
              {entry.name}{entry.isDirectory ? "/" : ""}
            </button>
          ))}
          {listing && listing.entries.length === 0 && listing.parent !== null && (
            <p className="onscreen-file-dialog-empty">Nothing here{state.extensionLabel ? ` (showing ${state.extensionLabel})` : ""}.</p>
          )}
        </div>
        <div className="onscreen-file-dialog-footer">
          <button type="button" className="onscreen-file-dialog-cancel" onClick={() => state.resolve(null)}>
            Cancel ({backHint(inputDevice, keyboardBindings, gamepadBindings)})
          </button>
        </div>
      </div>
    </div>
  );
}
