import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatchAgent } from "../../context/MatchAgentContext";
import { useIdentity } from "../../context/IdentityContext";
import { useJoinSettings } from "../../context/JoinSettingsContext";
import { useDownloadSession } from "../../context/DownloadSessionContext";
import { useHostBridge } from "../../bridge/hostBridge";
import { Lightbox } from "../../components/Lightbox";
import { InstallGameLauncherLightbox } from "../../components/InstallGameLauncherLightbox";
import { SelectionBoard } from "../../components/Selection";

const STORAGE_KEY = "match-agent-client:matchmaker-url";
// No real hosted default exists yet - this points at titled-room/client's
// local dev server, the only matchmaker this repo currently ships.
const DEFAULT_URL = "http://localhost:5183";

export function MatchMakingPage() {
  const matchAgent = useMatchAgent();
  const identity = useIdentity();
  const { playerSlots } = useJoinSettings();
  const { setSession } = useDownloadSession();
  const navigate = useNavigate();

  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL);
  const [connecting, setConnecting] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { connected, pendingLightbox, resolveInstallLightbox, resolveSelectionLightbox, cancelSelectionLightbox } =
    useHostBridge({
      iframeRef,
      iframeLoaded,
      matchAgent: matchAgent.settings,
      identityKeys: identity.keys,
      machineId: identity.machineId,
      playerSlots,
      onInitiateRelay: (session) => {
        setSession(session);
        navigate("/download");
      },
    });

  const handleConnect = () => {
    localStorage.setItem(STORAGE_KEY, url);
    setIframeLoaded(false);
    setConnecting(true);
  };

  return (
    <div className="page">
      <h1>Match Making</h1>
      <label>
        Matchmaker URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <button type="button" onClick={handleConnect}>Connect</button>

      {connecting && (
        <div className="matchmaker-frame-wrap">
          {!connected && <p>Connecting to matchmaker...</p>}
          <iframe
            ref={iframeRef}
            src={url}
            className="matchmaker-frame"
            title="Matchmaker"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      )}

      {pendingLightbox?.type === "install" && (
        <Lightbox>
          <InstallGameLauncherLightbox pluginName={pendingLightbox.pluginName} onDone={resolveInstallLightbox} />
        </Lightbox>
      )}

      {pendingLightbox?.type === "selection" && (
        <Lightbox onClose={cancelSelectionLightbox}>
          <SelectionBoard
            rosterConfig={pendingLightbox.rosterConfig}
            playerSlots={playerSlots.slice(0, pendingLightbox.numPlayers)}
            matchAgentUrl={matchAgent.settings.url}
            matchAgentAuth={matchAgent.settings.authCode}
            onConfirm={resolveSelectionLightbox}
          />
        </Lightbox>
      )}
    </div>
  );
}
