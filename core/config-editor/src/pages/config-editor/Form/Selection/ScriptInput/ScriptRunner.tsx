import { useState } from "react";
import type { ScriptPurposeInput } from "@roster-lock/shared";
import { GasLimittedScript } from "@roster-lock/types";
import { useDraftScriptInfo } from "../../Contexts/DraftScriptInfo";
import { useRosterLock } from "../../Contexts/RosterLock";
import { ROSTERLOCK_SIDECAR } from "../../../../../globals/side-car";

type ScriptPurpose = "piece-user-validation" | "piece-merge" | "global-validation";

function defaultPurposeInput(purpose: ScriptPurpose, pieceType?: string): ScriptPurposeInput {
  if (purpose === "piece-user-validation") {
    return {
      type: "piece-user-validation",
      pieceType: pieceType ?? "piece",
      userId: "test-user",
      input: [],
    };
  }
  if (purpose === "piece-merge") {
    return {
      type: "piece-merge",
      pieceType: pieceType ?? "piece",
      users: ["player1", "player2"],
      input: { "player1": [], "player2": [] },
    };
  }
  return {
    type: "global-validation",
    pieceTypes: [],
    users: ["player1", "player2"],
    input: {},
  };
}

type Props = {
  script: GasLimittedScript;
  purpose: ScriptPurpose;
  pieceType?: string;
};

export function ScriptRunner({ script, purpose, pieceType }: Props) {
  const { value: draftScriptInfo } = useDraftScriptInfo();
  const { value: config } = useRosterLock();

  const [expanded, setExpanded] = useState(false);
  const [purposeJson, setPurposeJson] = useState(
    () => JSON.stringify(defaultPurposeInput(purpose, pieceType), null, 2)
  );
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output: unknown } | { error: string } | null>(null);

  const run = async () => {
    let parsedPurpose: ScriptPurposeInput;
    try {
      parsedPurpose = JSON.parse(purposeJson);
      setPurposeError(null);
    } catch {
      setPurposeError("Invalid JSON");
      return;
    }

    const scriptMapping = Object.fromEntries(
      Object.entries(draftScriptInfo).map(([rel, info]) => [rel, info.referencePath])
    );

    setRunning(true);
    setResult(null);
    try {
      const output = await ROSTERLOCK_SIDECAR.runScript({
        config,
        randomSeeds: ["test-seed"],
        purpose: parsedPurpose,
        entryScript: script
      });
      setResult({ output });
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}>
        Run Script
      </button>
    );
  }

  return (
    <div className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h5 style={{ margin: 0 }}>Test Runner</h5>
        <button type="button" onClick={() => setExpanded(false)}>Close</button>
      </div>
      <div>

      </div>

      <div>
        <label>
          <div>Purpose Input (JSON)</div>
          <textarea
            rows={10}
            style={{ width: "100%", fontFamily: "monospace", fontSize: "13px" }}
            value={purposeJson}
            onChange={e => {
              setPurposeJson(e.target.value);
              setPurposeError(null);
            }}
          />
        </label>
        {purposeError && <div className="error">{purposeError}</div>}
      </div>

      <button type="button" onClick={run} disabled={running}>
        {running ? "Running…" : "Run"}
      </button>

      {result && (
        <div>
          {"error" in result ? (
            <pre style={{ color: "red", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {result.error}
            </pre>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
