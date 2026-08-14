import { useEffect, useState } from "react";
import { useMatchAgent } from "../context/MatchAgentContext";
import { installGameRunnerPlugin } from "../api/matchAgent";
import { GameRunnerSettingsForm } from "./GameRunnerSettingsForm";

// Content for the Lightbox opened by the installGameRunnerPlugin bridge
// request: installs the plugin package, then lets the user finish local
// config (binaryLocation) with the same form the standalone
// /game-runner/:pluginName route uses, before resolving the bridge request.
export function InstallGameRunnerLightbox({ pluginName, onDone }: { pluginName: string, onDone: () => void }) {
  const { settings } = useMatchAgent();
  const [installing, setInstalling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installGameRunnerPlugin(settings.url, settings.authCode, pluginName)
      .catch((e) => setError((e as Error).message))
      .finally(() => setInstalling(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName]);

  return (
    <div className="page">
      <h1>Install {pluginName}</h1>
      {installing && <p>Installing...</p>}
      {error && <p className="error">{error}</p>}
      {!installing && <GameRunnerSettingsForm pluginName={pluginName} />}
      <button type="button" onClick={onDone}>Done</button>
    </div>
  );
}
