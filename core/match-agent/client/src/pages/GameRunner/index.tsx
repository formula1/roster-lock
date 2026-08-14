import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMatchAgent } from "../../context/MatchAgentContext";
import { listAvailableGameRunners, AvailableGameRunner } from "../../api/matchAgent";

export function GameRunnerListPage() {
  const { settings } = useMatchAgent();
  const [runners, setRunners] = useState<Array<AvailableGameRunner>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAvailableGameRunners(settings.url, settings.authCode)
      .then(setRunners)
      .catch((e) => setError(e.message));
  }, [settings]);

  return (
    <div className="page">
      <h1>Game Runners</h1>
      {error && <p className="error">{error}</p>}
      <ul>
        {runners.map((r) => (
          <li key={r.pluginName}>
            <Link to={`/game-runner/${encodeURIComponent(r.pluginName)}`}>{r.publicInfo.title}</Link>
            {" - "}{r.publicInfo.description}
          </li>
        ))}
      </ul>
      {runners.length === 0 && !error && <p>No game-runner plugins installed on this match-agent yet.</p>}
    </div>
  );
}
