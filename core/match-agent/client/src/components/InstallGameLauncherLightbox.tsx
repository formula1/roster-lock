import { useState } from "react";
import { useMatchAgent } from "../context/MatchAgentContext";
import { installGameLauncherPlugin } from "../api/matchAgent";
import { GameLauncherSettingsForm } from "./GameLauncherSettingsForm";

type Phase = "confirm" | "installing" | "done";

// Content for the Lightbox opened by the installGameLauncherPlugin bridge request. Starts by
// asking the user to confirm - the embedding game picked this plugin name, not the user, so
// nothing gets installed on their machine without them explicitly agreeing to it here. Only after
// that does it install the plugin package, then let the user finish local config (binaryLocation)
// with the same form the standalone /game-launcher/:pluginName route uses, before resolving the
// bridge request.
export function InstallGameLauncherLightbox(
  { pluginName, onDone, onCancel }: { pluginName: string, onDone: () => void, onCancel: () => void }
) {
  const { settings } = useMatchAgent();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);

  const confirmInstall = () => {
    setPhase("installing");
    installGameLauncherPlugin(settings.url, settings.authCode, pluginName)
      .catch((e) => setError((e as Error).message))
      .finally(() => setPhase("done"));
  };

  return (
    <div className="page">
      <h1>Install {pluginName}</h1>
      {phase === "confirm" && (
        <>
          <p>This game wants to install the "{pluginName}" game launcher plugin on this machine.</p>
          <button type="button" onClick={confirmInstall}>Install</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </>
      )}
      {phase === "installing" && <p>Installing...</p>}
      {error && <p className="error">{error}</p>}
      {phase === "done" && <GameLauncherSettingsForm pluginName={pluginName} />}
      {phase === "done" && <button type="button" onClick={onDone}>Done</button>}
    </div>
  );
}
