import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatchAgent } from "../../context/MatchAgentContext";

export function ConnectPage({ autoSubmit }: { autoSubmit?: boolean }) {
  const { settings, connecting, error, updateSettings, connect } = useMatchAgent();
  const [url, setUrl] = useState(settings.url);
  const [authCode, setAuthCode] = useState(settings.authCode);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { url, authCode };
    updateSettings(next);
    const ok = await connect(next);
  };

  useEffect(()=>{
    if(!autoSubmit) return;
    const next = { url, authCode };
    updateSettings(next);
    connect(next);
  }, [autoSubmit])

  if(autoSubmit && (connecting || !error)) return null;

  return (
    <div className="page">
      <h1>Connect to Match Agent</h1>
      <p>Point this app at the match-agent server running on this machine.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Match Agent URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Auth Code
          <input type="password" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
        </label>
        <button type="submit" disabled={connecting}>
          {connecting ? "Connecting..." : "Connect"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
