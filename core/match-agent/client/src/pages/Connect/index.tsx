import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatchAgent } from "../../context/MatchAgentContext";

export function ConnectPage() {
  const { settings, connected, connecting, error, updateSettings, connect } = useMatchAgent();
  const [url, setUrl] = useState(settings.url);
  const [authCode, setAuthCode] = useState(settings.authCode);
  const navigate = useNavigate();

  const handleConnect = async () => {
    const next = { url, authCode };
    updateSettings(next);
    await connect(next);
  };

  return (
    <div className="page">
      <h1>Connect to Match Agent</h1>
      <p>Point this app at the match-agent server running on this machine.</p>
      <label>
        Match Agent URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label>
        Auth Code
        <input type="password" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
      </label>
      <button type="button" disabled={connecting} onClick={handleConnect}>
        {connecting ? "Connecting..." : "Connect"}
      </button>
      {error && <p className="error">{error}</p>}
      {connected && (
        <div>
          <p className="success">Connected.</p>
          <button type="button" onClick={() => navigate("/join-settings")}>Continue</button>
        </div>
      )}
    </div>
  );
}
