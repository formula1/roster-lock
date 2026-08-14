import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../context/AccountContext";

export function AccountPage() {
  const { token, profile, loading, error, register, validate, login, logout, setDisplayName } = useAccount();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register" | "validate">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationToken, setValidationToken] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleRegister = async () => {
    setFormError(null);
    try {
      await register(email);
      setMode("validate");
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const handleValidate = async () => {
    setFormError(null);
    try {
      await validate(email, validationToken, password);
      setMode("login");
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const handleLogin = async () => {
    setFormError(null);
    try {
      await login(email, password);
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
        <button type="button" onClick={() => navigate("/rooms")}>Continue</button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Account</h1>
      <div className="tabs">
        <button type="button" data-active={mode === "login"} onClick={() => setMode("login")}>Log in</button>
        <button type="button" data-active={mode === "register"} onClick={() => setMode("register")}>Register</button>
        <button type="button" data-active={mode === "validate"} onClick={() => setMode("validate")}>Verify email</button>
      </div>

      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {mode === "register" && (
        <button type="button" disabled={loading} onClick={handleRegister}>Send validation email</button>
      )}

      {mode === "validate" && (
        <>
          <label>
            Validation token
            <input value={validationToken} onChange={(e) => setValidationToken(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="button" disabled={loading} onClick={handleValidate}>Verify and set password</button>
        </>
      )}

      {mode === "login" && (
        <>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="button" disabled={loading} onClick={handleLogin}>Log in</button>
        </>
      )}

      {(formError || error) && <p className="error">{formError ?? error}</p>}
    </div>
  );
}
