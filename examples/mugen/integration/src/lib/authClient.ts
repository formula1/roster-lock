// Thin wrapper around examples/services/auth-naive's HTTP surface - see
// examples/mugen/services/titled-room/client/src/api/auth.ts for the
// email-verified equivalent this mirrors.

async function authFetch(authServiceUrl: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, authServiceUrl);
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Auth request to ${path} failed (${res.status})`);
  }
  return res;
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function register(authServiceUrl: string, username: string, password: string): Promise<void> {
  await authFetch(authServiceUrl, "/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
}

export async function login(authServiceUrl: string, username: string, password: string): Promise<string> {
  const res = await authFetch(authServiceUrl, "/auth/login", {
    method: "POST", body: JSON.stringify({ username, password }),
  });
  const { token } = await res.json() as { token: string };
  return token;
}

export async function setPublicKey(authServiceUrl: string, token: string, publicKey: string): Promise<void> {
  await authFetch(authServiceUrl, "/auth/set-public-key", {
    method: "POST", headers: authHeader(token), body: JSON.stringify({ publicKey }),
  });
}

export async function setPlayers(authServiceUrl: string, token: string, playerCount: number): Promise<void> {
  await authFetch(authServiceUrl, "/auth/set-players", {
    method: "POST", headers: authHeader(token), body: JSON.stringify({ playerCount }),
  });
}
