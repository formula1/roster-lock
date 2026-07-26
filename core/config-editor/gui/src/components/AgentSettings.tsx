import { useState } from "react";
import { useAgentConnection, DEFAULT_AGENT_URL } from "../globals/agent";

// Connecting a match-agent lights up the plugin-backed features (testing
// download sources, running selection scripts). Without one, those parts of
// the editor stay hidden/disabled.
export function AgentSettingsSection(){
  const connection = useAgentConnection();
  const [url, setUrl] = useState(connection.settings?.url ?? DEFAULT_AGENT_URL);
  const [authCode, setAuthCode] = useState(connection.settings?.authCode ?? "");

  return <div className="section">
    <h3>Match Agent</h3>
    <p>
      Connect to a running match-agent to test download sources and run
      selection scripts. Start one with <code>rosterlock-match-agent run</code>.
    </p>
    <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
      <label>
        <div>Agent URL</div>
        <input
          style={{ width: "100%" }}
          type="text"
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          placeholder={DEFAULT_AGENT_URL}
        />
      </label>
      <label>
        <div>Auth Code</div>
        <input
          style={{ width: "100%" }}
          type="password"
          value={authCode}
          onChange={(e)=>setAuthCode(e.target.value)}
        />
      </label>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          disabled={connection.status === "connecting" || !url || !authCode}
          onClick={()=>{
            connection.connect({ url, authCode }).catch(()=>{
              // the connection state carries the error message
            });
          }}
        >{connection.status === "connecting" ? "Connecting..." : "Connect"}</button>
        {connection.settings && (
          <button onClick={connection.disconnect}>Disconnect</button>
        )}
        <ConnectionStatus />
      </div>
    </div>
  </div>;
}

function ConnectionStatus(){
  const { status, error } = useAgentConnection();
  if(status === "connected") return <span style={{ color: "green" }}>Connected</span>;
  if(status === "connecting") return <span>Connecting...</span>;
  if(status === "error") return <span className="error">{error || "Connection failed"}</span>;
  return <span>Not connected</span>;
}
