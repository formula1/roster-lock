import { useEffect, useState } from "react";
import { useMatchAgent } from "../context/MatchAgentContext";
import {
  getGameRunnerSettings, setGameRunnerSettings, getGameRunnerVersion, updateGameRunnerBinary,
} from "../api/matchAgent";

// binaryLocation/version/update form for one game-runner plugin - shared by
// pages/GameRunner/Detail.tsx (the standalone settings route) and
// components/InstallGameRunnerLightbox.tsx (the same form, right after a
// fresh install, inside the lightbox the host opens for the
// installGameRunnerPlugin bridge call).
export function GameRunnerSettingsForm({ pluginName }: { pluginName: string }) {
  const { settings } = useMatchAgent();
  const [binaryLocation, setBinaryLocation] = useState("");
  const [version, setVersion] = useState<{ local: { title: string }, supported: { title: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getGameRunnerSettings(settings.url, settings.authCode, pluginName)
      .then((s) => setBinaryLocation(s.binaryLocation ?? ""))
      .catch((e) => setError(e.message));
  };

  useEffect(load, [pluginName, settings]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setGameRunnerSettings(settings.url, settings.authCode, pluginName, { binaryLocation });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const checkVersion = async () => {
    setBusy(true);
    setError(null);
    try {
      setVersion(await getGameRunnerVersion(settings.url, settings.authCode, pluginName));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateGameRunnerBinary(settings.url, settings.authCode, pluginName);
      await checkVersion();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="game-runner-settings-form">
      <label>
        Binary location
        <input value={binaryLocation} onChange={(e) => setBinaryLocation(e.target.value)} />
      </label>
      <button type="button" disabled={busy} onClick={save}>Save</button>
      <button type="button" disabled={busy || !binaryLocation} onClick={checkVersion}>Check version</button>
      <button type="button" disabled={busy || !binaryLocation} onClick={download}>Download / update</button>
      {version && (
        <p>Local: {version.local.title} - Supported: {version.supported.title}</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
