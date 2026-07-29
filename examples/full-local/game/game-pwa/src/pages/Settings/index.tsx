import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../../context/GameSessionContext";

export function SettingsScreen() {
  const navigate = useNavigate();
  const { matchAgent, updateSettings } = useGameSession();

  const [url, setUrl] = useState(matchAgent.url);
  const [authCode, setAuthCode] = useState(matchAgent.authCode);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [matchmakerUrl, setMatchmakerUrl] = useState(matchAgent.matchmakerUrl);
  const [gameCoordinatorUrl, setGameCoordinatorUrl] = useState(matchAgent.gameCoordinatorUrl);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateSettings({ url, authCode, matchmakerUrl, gameCoordinatorUrl });
    navigate("/connect");
  }

  return (
    <div>
      <h1>Connection Settings</h1>
      <p className="status">
        These default to a locally-running full-local example stack - change them if yours is somewhere else.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="url">Match Agent URL</label>
        <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} required />

        <label htmlFor="authCode">Auth Code</label>
        <div className="input-with-toggle">
          <input
            id="authCode"
            type={showAuthCode ? "text" : "password"}
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
          />
          <button type="button" className="secondary" onClick={() => setShowAuthCode((v) => !v)}>
            {showAuthCode ? "Hide" : "Show"}
          </button>
        </div>
        <p className="status">
          This grants full access to the match agent's pieces and match history - only enter it here if you trust
          this site.
        </p>

        <label htmlFor="matchmakerUrl">Matchmaker URL</label>
        <input
          id="matchmakerUrl"
          type="text"
          value={matchmakerUrl}
          onChange={(e) => setMatchmakerUrl(e.target.value)}
          required
        />

        <label htmlFor="gameCoordinatorUrl">Game Coordinator URL</label>
        <input
          id="gameCoordinatorUrl"
          type="text"
          value={gameCoordinatorUrl}
          onChange={(e) => setGameCoordinatorUrl(e.target.value)}
          required
        />

        <div className="actions">
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
