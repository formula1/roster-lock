import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../context/AccountContext";

export function AccountPage() {
  const { token, profile, loading, error, register, login, logout, setDisplayName } = useAccount();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleRegister = async () => {
    setFormError(null);
    try {
      await register(username, password);
      await login(username, password);
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const handleLogin = async () => {
    setFormError(null);
    try {
      await login(username, password);
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  if (token && profile) {
    return (
      <div className="page">
        <h1>Account</h1>
        <p>Signed in as {profile.displayName ?? profile.identifier}</p>
        <label>
          Display name
          <input value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} placeholder={profile.displayName} />
        </label>
        <button type="button" onClick={() => setDisplayName(displayNameInput)} disabled={!displayNameInput}>
          Save display name
        </button>
        <button type="button" onClick={logout}>Log out</button>
        <button type="button" data-testid="account-continue" onClick={() => navigate("/rooms")}>Continue</button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Account</h1>
      <div className="tabs">
        <button type="button" data-testid="account-tab-login" data-active={mode === "login"} onClick={() => setMode("login")}>Log in</button>
        <button type="button" data-testid="account-tab-register" data-active={mode === "register"} onClick={() => setMode("register")}>Register</button>
      </div>

      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>

      {mode === "register" && (
        <button type="button" data-testid="account-submit-register" disabled={loading} onClick={handleRegister}>Register</button>
      )}

      {mode === "login" && (
        <button type="button" data-testid="account-submit-login" disabled={loading} onClick={handleLogin}>Log in</button>
      )}

      {(formError || error) && <p className="error">{formError ?? error}</p>}
    </div>
  );
}
