import { useEffect, useState } from "react";
import { useMatchAgent } from "../context/MatchAgentContext";
import { installGameLauncherPlugin } from "../api/matchAgent";
import { GameLauncherSettingsForm } from "./GameLauncherSettingsForm";

// Content for the Lightbox opened by the installGameLauncherPlugin bridge
// request: installs the plugin package, then lets the user finish local
// config (binaryLocation) with the same form the standalone
// /game-launcher/:pluginName route uses, before resolving the bridge request.
export function InstallGameLauncherLightbox({ pluginName, onDone }: { pluginName: string, onDone: () => void }) {
  const { settings } = useMatchAgent();
  const [installing, setInstalling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    installGameLauncherPlugin(settings.url, settings.authCode, pluginName)
      .catch((e) => setError((e as Error).message))
      .finally(() => setInstalling(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName]);

  return (
    <div className="page">
      <h1>Install {pluginName}</h1>
      {installing && <p>Installing...</p>}
      {error && <p className="error">{error}</p>}
      {!installing && <GameLauncherSettingsForm pluginName={pluginName} />}
      <button type="button" onClick={onDone}>Done</button>
    </div>
  );
}
