import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { validateAuthCode } from "@roster-lock/ts-client";
import { useGameSession } from "../../context/GameSessionContext";
import { describeError } from "../../utils/describeError";

export function ConnectScreen() {
  const navigate = useNavigate();
  const { matchAgent, user, connected, connect, updateSettings } = useGameSession();

  const [authCode, setAuthCode] = useState(matchAgent.authCode);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [checking, setChecking] = useState(true);
  const [needsAuthCode, setNeedsAuthCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-validates whenever we land here without a confirmed connection - on
  // first load (checking a saved auth code), and again after Settings saves
  // new values (updateSettings resets `connected` to force this).
  useEffect(() => {
    if (connected) {
      navigate("/roster", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setChecking(true);
      setError(null);
      try {
        const isValid = await validateAuthCode(matchAgent.authCode, matchAgent.url);
        if (cancelled) return;
        if (isValid) {
          await connect(displayName || user?.displayName || "Player");
          navigate("/roster", { replace: true });
          return;
        }
        setNeedsAuthCode(true);
      } catch (err) {
        if (cancelled) return;
        setError(describeError(err, "Couldn't reach the match agent."));
        setNeedsAuthCode(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const isValid = await validateAuthCode(authCode, matchAgent.url);
      if (!isValid) {
        setError("Auth code was rejected by the match agent.");
        setChecking(false);
        return;
      }
      updateSettings({ ...matchAgent, authCode });
      await connect(displayName || "Player");
      navigate("/roster");
    } catch (err) {
      setError(describeError(err, "Couldn't reach the match agent."));
      setChecking(false);
    }
  }

  if (checking) {
    return <p className="status">Checking saved connection...</p>;
  }

  if (!needsAuthCode) {
    return null;
  }

  return (
    <div>
      <h1>Connect to Match Agent</h1>
      <p className="status">
        Match agent at <code>{matchAgent.url}</code> needs an auth code.
      </p>

      {error && <div className="banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="authCode">Auth Code</label>
        <div className="input-with-toggle">
          <input
            id="authCode"
            type={showAuthCode ? "text" : "password"}
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            required
          />
          <button type="button" className="secondary" onClick={() => setShowAuthCode((v) => !v)}>
            {showAuthCode ? "Hide" : "Show"}
          </button>
        </div>
        <p className="status">
          This grants full access to the match agent's pieces and match history - only enter it here if you trust
          this site.
        </p>

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
      </form>

      <p className="status">
        <Link to="/settings">Wrong match agent / matchmaker / game coordinator?</Link>
      </p>
    </div>
  );
}
