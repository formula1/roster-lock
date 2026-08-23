import { ChangeEvent, useEffect, useRef, useState } from "react";
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
const SAVED_STORAGE_KEY = "match-agent-client:saved-matchmaker-urls";
// No real hosted default exists yet - this points at titled-room/client's
// local dev server, the only matchmaker this repo currently ships.
const DEFAULT_URL = "http://localhost:5183";

type SavedMatchmaker = { title: string, url: string };

function loadSaved(): Array<SavedMatchmaker> {
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function MatchMakingPage() {
  const matchAgent = useMatchAgent();
  const identity = useIdentity();
  const { playerSlots } = useJoinSettings();
  const { setSession } = useDownloadSession();
  const navigate = useNavigate();

  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL);
  const [title, setTitle] = useState("");
  const [savedUrls, setSavedUrls] = useState<Array<SavedMatchmaker>>(loadSaved);
  const [selectedSaved, setSelectedSaved] = useState("");
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { connectionError, pendingLightbox, resolveInstallLightbox, resolveSelectionLightbox, cancelSelectionLightbox } =
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

  useEffect(() => {
    if (!connectionError) return;
    setConnecting(false);
    setErrorMessage(`Could not connect to the matchmaker at ${connectedUrl}.`);
  }, [connectionError, connectedUrl]);

  const handleConnect = (targetUrl: string = url) => {
    localStorage.setItem(STORAGE_KEY, targetUrl);
    setIframeLoaded(false);
    setErrorMessage(null);
    setConnectedUrl(targetUrl);
    setConnecting(true);
  };

  // Reconnect to whatever URL was last used, so returning users land in the
  // matchmaker without an extra click. A manual Connect button remains below
  // in case this first attempt fails (e.g. a stale/unreachable saved URL).
  useEffect(() => {
    handleConnect(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setSelectedSaved("");
    // The iframe/bridge only ever target `connectedUrl`, so once the user
    // edits the field the in-flight connection is stale - drop it rather
    // than leaving `connecting` true against a URL that's no longer shown.
    setConnecting(false);
    setErrorMessage(null);
  };

  const handleIframeError = () => {
    setConnecting(false);
    setErrorMessage(`Failed to load the matchmaker at ${connectedUrl}.`);
  };

  const persistSaved = (next: Array<SavedMatchmaker>) => {
    setSavedUrls(next);
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
  };

  const handleSaveCurrent = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const withoutExisting = savedUrls.filter((s) => s.title !== trimmedTitle);
    persistSaved([...withoutExisting, { title: trimmedTitle, url }]);
    setSelectedSaved(trimmedTitle);
  };

  const handleSelectSaved = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextTitle = e.target.value;
    setSelectedSaved(nextTitle);
    const entry = savedUrls.find((s) => s.title === nextTitle);
    if (!entry) return;
    setTitle(entry.title);
    setUrl(entry.url);
    handleConnect(entry.url);
  };

  const handleDeleteSaved = () => {
    if (!selectedSaved) return;
    persistSaved(savedUrls.filter((s) => s.title !== selectedSaved));
    setSelectedSaved("");
  };

  return (
    <div className="page">
      <h1>Match Making</h1>
      <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
        <select value={selectedSaved} onChange={handleSelectSaved}>
          <option value="">Saved matchmakers...</option>
          {savedUrls.map((s) => (
            <option key={s.title} value={s.title}>{s.title}</option>
          ))}
        </select>
        <button type="button" onClick={handleDeleteSaved} disabled={!selectedSaved}>Delete</button>
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          style={{ flexGrow: 1 }}
          placeholder="Matchmaker URL"
          value={url}
          onChange={handleUrlChange}
        />
        <button type="button" onClick={handleSaveCurrent} disabled={!title.trim()}>Save</button>
        <button type="button" onClick={() => handleConnect()}>Connect</button>
      </div>

      {errorMessage && <p className="error">{errorMessage}</p>}

      {connecting && connectedUrl && (
        <div className="matchmaker-frame-wrap">
          <iframe
            ref={iframeRef}
            src={connectedUrl}
            className="matchmaker-frame"
            title="Matchmaker"
            onLoad={() => setIframeLoaded(true)}
            onError={handleIframeError}
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
