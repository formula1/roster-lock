import { useEffect, useState } from "react";
import { useMatchAgent } from "../../context/MatchAgentContext";
import { listGameProcesses, stopGameRunner, GameProcessSummary } from "../../api/matchAgent";

const POLL_INTERVAL_MS = 2000;

// Every game process this machine's match-agent has started, regardless of
// which page launched it (today that's only pages/Download's "Start Match"
// button) - lets a player see a game is actually running, and close it,
// without having to go find the real game window.
export function GameStatusPage() {
  const { settings } = useMatchAgent();
  const [processes, setProcesses] = useState<Array<GameProcessSummary>>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      listGameProcesses(settings.url, settings.authCode)
        .then((next) => { if (!cancelled) setProcesses(next); })
        .catch((e) => { if (!cancelled) setError(e.message); });
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [settings]);

  const handleClose = async (proc: GameProcessSummary) => {
    setStoppingId(proc.handleId);
    setError(null);
    try {
      await stopGameRunner(settings.url, settings.authCode, proc.pluginName, proc.handleId);
      const next = await listGameProcesses(settings.url, settings.authCode);
      setProcesses(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStoppingId(null);
    }
  };

  return (
    <div className="page">
      <h1>Games</h1>
      {error && <p className="error">{error}</p>}
      <ul className="game-process-list">
        {processes.map((proc) => (
          <li key={proc.handleId} className="game-process-row">
            <span>{proc.pluginName}</span>
            <span>{proc.exited === false ? "Running" : `Exited (code ${proc.exited.code})`}</span>
            <button
              type="button"
              disabled={proc.exited !== false || stoppingId === proc.handleId}
              onClick={() => handleClose(proc)}
            >
              {stoppingId === proc.handleId ? "Closing..." : "Close"}
            </button>
          </li>
        ))}
      </ul>
      {processes.length === 0 && !error && <p>No games have been started through this match-agent yet.</p>}
    </div>
  );
}
