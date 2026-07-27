import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { validateAuthCode } from "@roster-lock/ts-client";
import { useGameSession } from "../../context/GameSessionContext";

export function ConnectScreen() {
  const navigate = useNavigate();
  const { matchAgent, user, connect } = useGameSession();

  const [url, setUrl] = useState(matchAgent?.url ?? "http://localhost:8080");
  const [authCode, setAuthCode] = useState(matchAgent?.authCode ?? "");
  const [matchmakerUrl, setMatchmakerUrl] = useState(matchAgent?.matchmakerUrl ?? "http://localhost:8081");
  const [gameCoordinatorUrl, setGameCoordinatorUrl] = useState(
    matchAgent?.gameCoordinatorUrl ?? "http://localhost:8082",
  );
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("Validating auth code...");
    try {
      const isValid = await validateAuthCode(authCode, url);
      if (!isValid) {
        setError("Auth code was rejected by the match agent.");
        setStatus(null);
        return;
      }
      await connect({ url, authCode, matchmakerUrl, gameCoordinatorUrl }, displayName || "Player");
      navigate("/roster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the match agent.");
      setStatus(null);
    }
  }

  return (
    <div>
      <h1>Connect to Match Agent</h1>
      <p className="status">Enter the local match agent's address and auth code.</p>

      {error && <div className="banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="url">Match Agent URL</label>
        <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} required />

        <label htmlFor="authCode">Auth Code</label>
        <input
          id="authCode"
          type="password"
          value={authCode}
          onChange={(e) => setAuthCode(e.target.value)}
          required
        />

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

        <label htmlFor="displayName">Display Name</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Player"
        />

        <div className="actions">
          <button type="submit">Connect</button>
        </div>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  );
}
