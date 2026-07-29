import { ChangeEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RosterLockV1Config } from "@roster-lock/types";
import { useGameSession } from "../../context/GameSessionContext";
import { describeError } from "../../utils/describeError";

export function RosterUploadScreen() {
  const navigate = useNavigate();
  const { rosterConfig, setRosterConfig } = useGameSession();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RosterLockV1Config;
      if (
        parsed?.configIdentity?.namespace !== "roster-lock" ||
        parsed?.configIdentity?.purpose !== "lock" ||
        parsed?.configIdentity?.version !== 1
      ) {
        throw new Error("This doesn't look like a v1 roster-lock config file.");
      }
      setRosterConfig(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(describeError(err, "Couldn't read that file - make sure it's the published roster-lock config JSON."));
    }
  }

  return (
    <div>
      <h1>Load Roster Config</h1>
      <p className="status">Upload the published roster-lock config for the game you want to play.</p>

      {error && <div className="banner">{error}</div>}

      <label htmlFor="roster-file">Roster Lock Config (.json)</label>
      <input id="roster-file" type="file" accept=".json,application/json" onChange={handleFile} />

      {rosterConfig && (
        <p className="status">
          Loaded {fileName ? `"${fileName}"` : "config"}: {rosterConfig.title} v{rosterConfig.version}{" "}
          (engine: {rosterConfig.engine.name} v{rosterConfig.engine.version})
        </p>
      )}

      <div className="actions">
        <button disabled={!rosterConfig} onClick={() => navigate("/select")}>
          Continue
        </button>
      </div>
    </div>
  );
}
