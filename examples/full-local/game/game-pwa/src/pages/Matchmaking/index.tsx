import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../../context/GameSessionContext";
import { joinMatch } from "../../game/matchmaking";

export function MatchmakingScreen() {
  const navigate = useNavigate();
  const { matchAgent, user, rosterConfig, setMatch } = useGameSession();
  const [status, setStatus] = useState("Joining matchmaking queue...");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!matchAgent || !user || !rosterConfig) return;
    started.current = true;

    joinMatch(user, rosterConfig, matchAgent.matchmakerUrl, (attempt) => {
      setStatus(`Waiting for an opponent... (attempt ${attempt + 1})`);
    })
      .then((match) => {
        setMatch(match);
        navigate("/download");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Matchmaking failed.");
      });
  }, [matchAgent, user, rosterConfig, setMatch, navigate]);

  return (
    <div>
      <h1>Matchmaking</h1>
      {error ? (
        <div className="banner">{error}</div>
      ) : (
        <>
          <p className="status">{status}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "100%" }} />
          </div>
        </>
      )}
    </div>
  );
}
