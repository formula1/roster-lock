
import { useState, useMemo } from "react";
import { useRosterLock } from "../../../../Contexts/RosterLock";
import { useHost } from "../../../../../../globals/Host";
import type { ScriptPurpose } from "../RunScript/script-purpose";
import { SCRIPT_PURPOSES } from "../RunScript/script-purpose";
import { buildDts, downloadDts,  } from "./build-dts";
import { COMMON_GLOBALS, PURPOSE_GLOBALS, PURPOSE_RETURN } from "./constants";




export function ScriptGlobalDocsPage() {
  const host = useHost();
  const { value: lock } = useRosterLock();
  const [purpose, setPurpose] = useState<ScriptPurpose>("piece-user-validation");
  const [pieceType, setPieceType] = useState<string>("");

  const selectablePieces = useMemo(() => {
    return Object.entries(lock.engine.pieceDefinitions).filter(
      ([, def]) => def.selectionStrategy !== "mandatory" && def.selectionStrategy !== "on demand"
    );
  }, [lock]);

  const selectedPiece = useMemo(() => {
    const first = selectablePieces[0]?.[0];
    const key = pieceType || first || "";
    return { type: key, def: lock.engine.pieceDefinitions[key] };
  }, [pieceType, selectablePieces, lock]);

  const accessiblePieceTypes = useMemo(() => {
    if (purpose === "global-validation") {
      return Object.keys(lock.engine.pieceDefinitions);
    }
    if (!selectedPiece.type || !selectedPiece.def) return [];
    const allowed = new Set<string>();
    const collect = (type: string) => {
      if (allowed.has(type)) return;
      allowed.add(type);
      for (const req of lock.engine.pieceDefinitions[type]?.requires ?? []) {
        collect(req);
      }
    };
    collect(selectedPiece.type);
    return [...allowed];
  }, [purpose, selectedPiece, lock]);

  const pieceMeta = useMemo(() => {
    if (purpose === "global-validation" || !selectedPiece.type) return null;
    return lock.pieceMeta[selectedPiece.type] ?? null;
  }, [purpose, selectedPiece, lock]);

  const isPieceSpecific = purpose !== "global-validation";

  const handleDownload = () => {
    downloadDts(host, buildDts(lock), "globals.d.ts");
  };

  return (
    <div className="section">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Script Globals</h3>
        <button onClick={handleDownload}>Download .d.ts</button>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div>
          <span>Purpose: </span>
          <select value={purpose} onChange={e => setPurpose(e.target.value as ScriptPurpose)}>
            {SCRIPT_PURPOSES.map(p => (
              <option key={p.value} value={p.value}>{p.title}</option>
            ))}
          </select>
        </div>

        {isPieceSpecific && (
          <div>
            <span>Piece Type: </span>
            <select
              value={selectedPiece.type}
              onChange={e => setPieceType(e.target.value)}
            >
              {selectablePieces.map(([type, def]) => (
                <option key={type} value={type}>{type} ({def.selectionStrategy})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="section">
        <h4>Purpose Globals</h4>
        <table>
          <tbody>
            {PURPOSE_GLOBALS[purpose].map(g => (
              <tr key={g.name}>
                <td style={{ fontFamily: "monospace", paddingRight: "1rem" }}>{g.name}</td>
                <td style={{ fontFamily: "monospace", opacity: 0.7 }}>{g.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Common Globals</h4>
        <table>
          <tbody>
            {COMMON_GLOBALS.map(g => (
              <tr key={g.name}>
                <td style={{ fontFamily: "monospace", paddingRight: "1rem" }}>{g.name}</td>
                <td style={{ fontFamily: "monospace", opacity: 0.7, paddingRight: "1rem" }}>{g.type}</td>
                <td style={{ opacity: 0.6, fontSize: "0.85em" }}>{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h4>Accessible Piece Types</h4>
        <p style={{ fontSize: "0.85em", opacity: 0.7, margin: "0 0 0.5rem" }}>
          {isPieceSpecific
            ? "Own piece type plus its required dependencies."
            : "All defined piece types."}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {accessiblePieceTypes.map(type => (
            <code key={type} style={{ padding: "0.1rem 0.4rem", background: "rgba(128,128,128,0.15)", borderRadius: "4px" }}>
              {type}
            </code>
          ))}
          {accessiblePieceTypes.length === 0 && (
            <span style={{ opacity: 0.5 }}>No selectable pieces defined</span>
          )}
        </div>
      </div>

      {pieceMeta && Object.keys(pieceMeta.schema).length > 0 && (
        <div className="section">
          <h4>Piece Meta Schema</h4>
          <p style={{ fontSize: "0.85em", opacity: 0.7, margin: "0 0 0.5rem" }}>
            Shape returned by <code>getPieceMeta("{selectedPiece.type}", pieceId)</code>
          </p>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pieceMeta.schema).map(([field, type]) => (
                <tr key={field}>
                  <td style={{ fontFamily: "monospace" }}>{field}</td>
                  <td style={{ fontFamily: "monospace", opacity: 0.7 }}>{type}</td>
                  <td style={{ fontFamily: "monospace", opacity: 0.6 }}>
                    {JSON.stringify(pieceMeta.defaultMeta[field])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pieceMeta && Object.keys(pieceMeta.schema).length === 0 && (
        <div className="section">
          <h4>Piece Meta Schema</h4>
          <p style={{ opacity: 0.5 }}>No meta fields defined for {selectedPiece.type}.</p>
        </div>
      )}

      <div className="section">
        <h4>Expected Return</h4>
        <code>{PURPOSE_RETURN[purpose]}</code>
      </div>
    </div>
  );
}
