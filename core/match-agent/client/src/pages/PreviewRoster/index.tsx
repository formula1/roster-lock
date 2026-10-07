import { useEffect, useState } from "react";
import { RosterLockV1Config, UserSelection } from "@roster-lock/types";
import { useMatchAgent } from "../../context/MatchAgentContext";
import { useJoinSettings } from "../../context/JoinSettingsContext";
import { useGlobalNav } from "../../context/GlobalNavContext";
import { readRosterLock, listAvailableGameLaunchers, AvailableGameLauncher } from "../../api/matchAgent";
import { SelectionBoard } from "../../components/Selection";

// Opens a SelectionBoard against a roster-lock config read straight off
// this machine's disk - no matchmaker, room, or live service (and so none
// of the Docker services/real login flow those need) involved at all.
// Before this page existed, SelectionBoard could only ever be reached via
// a live bridge.requestSelection round-trip (see MatchMakingPage's
// pendingLightbox) - which made even just trying out a roster's selection
// board, let alone a future save/load-a-preset feature, dependent on a
// whole matchmaker setup it has nothing to do with.
export function PreviewRosterPage() {
  const { settings } = useMatchAgent();
  const { playerSlots } = useJoinSettings();
  const { pickFile } = useGlobalNav();

  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [launchers, setLaunchers] = useState<Array<AvailableGameLauncher>>([]);
  const [pluginName, setPluginName] = useState("");

  const [rosterConfig, setRosterConfig] = useState<RosterLockV1Config | null>(null);
  const [result, setResult] = useState<Record<number, UserSelection> | null>(null);

  useEffect(() => {
    listAvailableGameLaunchers(settings.url, settings.authCode)
      .then((list) => {
        setLaunchers(list);
        setPluginName((current) => current || list[0]?.pluginName || "");
      })
      .catch((e) => setError(e.message));
  }, [settings]);

  const browse = async () => {
    setError(null);
    const picked = await pickFile({
      startPath: path || undefined, extension: ".roster-lock.json", extensionLabel: "roster-lock files",
    });
    if (picked) setPath(picked);
  };

  const load = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setRosterConfig(await readRosterLock(settings.url, settings.authCode, path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (rosterConfig && pluginName) {
    if (result) {
      return (
        <div className="page">
          <h1>Preview Roster</h1>
          <p>Confirmed - this is just a preview, so nothing further happens with this selection.</p>
          <pre className="preview-roster-result">{JSON.stringify(result, null, 2)}</pre>
          <button type="button" onClick={() => setResult(null)}>Back to selection</button>
        </div>
      );
    }
    return (
      <div className="page">
        <h1>Preview Roster</h1>
        <SelectionBoard
          rosterConfig={rosterConfig}
          playerSlots={playerSlots}
          pluginName={pluginName}
          matchAgentUrl={settings.url}
          matchAgentAuth={settings.authCode}
          onConfirm={setResult}
          onCancel={() => setRosterConfig(null)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Preview Roster</h1>
      <p>
        Load a roster-lock config straight off this machine's disk and try out its selection board - no
        matchmaker, room, or live service needed.
      </p>
      <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
        <input
          style={{ flexGrow: 1 }}
          placeholder="Path to a .roster-lock.json file"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <button type="button" disabled={busy} onClick={browse}>Browse...</button>
      </div>
      <label>
        Game launcher
        <select value={pluginName} onChange={(e) => setPluginName(e.target.value)}>
          {launchers.length === 0 && <option value="">No game-launcher plugins installed</option>}
          {launchers.map((l) => (
            <option key={l.pluginName} value={l.pluginName}>{l.publicInfo.title}</option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy || !path || !pluginName} onClick={load}>Load</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
