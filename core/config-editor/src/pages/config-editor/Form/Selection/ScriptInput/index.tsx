import { useState, useEffect } from "react";
import type { GasLimittedScript } from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { nativeAPI } from "../../../../../tauri";
import { useDraftScriptInfo } from "../../Contexts/DraftScriptInfo";
import { useRosterLock } from "../../Contexts/RosterLock";
import { LuaViewer } from "./LuaViewer";
import { ScriptRunner } from "./ScriptRunner";

type ScriptPurpose = "piece-user-validation" | "piece-merge" | "global-validation";

type Props = InputProps<GasLimittedScript | undefined> & {
  label: string;
  purpose: ScriptPurpose;
  pieceType?: string;
  onRemove?: () => void;
};

async function computeSHA256(content: string): Promise<string> {
  const buffer = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function basename(path: string): string {
  const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(lastSep + 1);
}

export function ScriptInput(
  { value, onChange, label, purpose, pieceType, onRemove }: Props
) {
  const { value: draftScriptInfo, onChange: onDraftScriptInfoChange } = useDraftScriptInfo();
  const { onChange: onRosterLockChange } = useRosterLock();

  const relativePath = value?.src;
  const scriptInfo = relativePath ? draftScriptInfo[relativePath] : undefined;

  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!scriptInfo?.referencePath) {
      setFileContent(null);
      setLoadError(null);
      setIsStale(false);
      return;
    }
    let cancelled = false;
    nativeAPI.fs.readFile(scriptInfo.referencePath)
      .then(async bytes => {
        if (cancelled) return;
        const content = new TextDecoder().decode(bytes);
        const sha = await computeSHA256(content);
        if (!cancelled) {
          setFileContent(content);
          setLoadError(null);
          setIsStale(sha !== scriptInfo.sha);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setFileContent(null);
          setLoadError((e as Error).message);
          setIsStale(false);
        }
      });
    return () => { cancelled = true; };
  }, [scriptInfo?.referencePath, scriptInfo?.sha]);

  const pickFile = async () => {
    const result = await nativeAPI.nativeWindow.showOpenDialog({
      title: `Select ${label}`,
      filters: [{ name: "Lua Scripts", extensions: ["lua"] }],
    });
    if (result.canceled || !result.filePaths[0]) return;

    const absolutePath = result.filePaths[0];
    const relative = basename(absolutePath);

    try {
      const bytes = await nativeAPI.fs.readFile(absolutePath);
      const content = new TextDecoder().decode(bytes);
      const sha = await computeSHA256(content);
      const now = new Date().toISOString();

      onRosterLockChange(old => ({
        ...old,
        selection: {
          ...old.selection,
          scripts: { ...old.selection.scripts, [relative]: content },
        },
      }));

      onDraftScriptInfoChange(old => ({
        ...old,
        [relative]: { lastLoad: now, sha, referencePath: absolutePath },
      }));

      onChange({ type: "text/lua", src: relative });
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };

  const reload = async () => {
    if (!scriptInfo?.referencePath || !relativePath) return;
    try {
      const bytes = await nativeAPI.fs.readFile(scriptInfo.referencePath);
      const content = new TextDecoder().decode(bytes);
      const sha = await computeSHA256(content);
      const now = new Date().toISOString();

      onRosterLockChange(old => ({
        ...old,
        selection: {
          ...old.selection,
          scripts: { ...old.selection.scripts, [relativePath]: content },
        },
      }));

      onDraftScriptInfoChange(old => ({
        ...old,
        [relativePath]: { ...old[relativePath], lastLoad: now, sha },
      }));

      setFileContent(content);
      setIsStale(false);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };

  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0 }}>{label}</h4>
        {onRemove && (
          <button type="button" onClick={onRemove}>Remove</button>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Pick a .lua file…"
          style={{ flexGrow: 1 }}
          value={relativePath ?? ""}
          readOnly
        />
        <button type="button" onClick={pickFile}>Browse…</button>
      </div>

      {scriptInfo && (
        <div style={{ fontSize: "0.85em", color: "#888" }}>
          {scriptInfo.referencePath}
        </div>
      )}

      {loadError && <div className="error">Could not read file: {loadError}</div>}

      {isStale && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#f0a500" }}>
          <span>File has changed since last load.</span>
          <button type="button" onClick={reload}>Reload</button>
        </div>
      )}

      {fileContent !== null && (
        <>
          <LuaViewer code={fileContent} />
          {relativePath && (
            <ScriptRunner
              script={value}
              purpose={purpose}
              pieceType={pieceType}
            />
          )}
        </>
      )}
    </div>
  );
}
