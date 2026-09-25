import { addAuthHeader, handleFetch } from "../../utils/fetch";

import { API_URL, Auth } from "./constants";


export const AUTH_API = {
  login: async ({ username, password }: { username: string, password: string })=>{
    const LOGIN_ENDPOINT = new URL(API_URL.pathname +'/admin/login', API_URL);
    return await handleFetch(fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })) as { token: string, passwordExpired: boolean };
  },
  refresh: async ({ authToken }: Auth) => {
    const REFRESH_ENDPOINT = new URL(API_URL.pathname +'/admin/refresh', API_URL);
    return await handleFetch(fetch(
      REFRESH_ENDPOINT,
      addAuthHeader(authToken)
    )) as { token: string };
  },
  me: async ({ authToken }: Auth) => {
    const ME_ENDPOINT = new URL(API_URL.pathname +'/admin/me', API_URL);
    return await handleFetch(fetch(
      ME_ENDPOINT,
      addAuthHeader(authToken)
    )) as { username: string; passwordStatus: string; passwordExpiresAt: string | null; createdAt: string };
  },
  updatePassword: async ({ authToken }: Auth, { password }: { password: string })=>{
    const UPDATE_PASSWORD_ENDPOINT = new URL(API_URL.pathname +'/admin/password', API_URL);
    return await handleFetch(fetch(
      UPDATE_PASSWORD_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    )) as { success: boolean };
  }
}

