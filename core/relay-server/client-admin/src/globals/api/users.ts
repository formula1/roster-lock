import { addAuthHeader, handleFetch } from "../../utils/fetch";

import { API_URL, Auth } from "./constants";

export const USERS_API = {
  list: async ({ authToken }: Auth) => {
    const LIST_ENDPOINT = new URL(API_URL.pathname +'/admin/users', API_URL);
    return await handleFetch(fetch(
      LIST_ENDPOINT,
      addAuthHeader(authToken)
    )) as { username: string; passwordStatus: string; passwordExpiresAt: string | null; createdAt: string }[];
  },
  get: async ({ authToken }: Auth, { username }: { username: string })=>{
    const GET_ENDPOINT = new URL(API_URL.pathname +'/admin/users/'+username, API_URL);
    return await handleFetch(fetch(
      GET_ENDPOINT,
      addAuthHeader(authToken)
    )) as {
        id: string;
        username: string;
        password_expires_at: string | null;
        created_at: string;
        updated_at: string;
    };
  },
  create: async ({ authToken }: Auth, { username }: { username: string })=>{
    const CREATE_ENDPOINT = new URL(API_URL.pathname +'/admin/users', API_URL);
    return await handleFetch(fetch(
      CREATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
    )) as { username: string; temporaryPassword: string; expiresAt: string };
  },
  reset: async ({ authToken }: Auth, { username }: { username: string })=>{
    const RESET_ENDPOINT = new URL(API_URL.pathname +'/admin/users/'+username+'/reset', API_URL);
    return await handleFetch(fetch(
      RESET_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'POST',
      })
    )) as { username: string; temporaryPassword: string; expiresAt: string };
  },
  delete: async ({ authToken }: Auth, { username }: { username: string })=>{
    const DELETE_ENDPOINT = new URL(API_URL.pathname +'/admin/users/'+username, API_URL);
    return await handleFetch(fetch(
      DELETE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'DELETE',
      })
    )) as { success: boolean };
  }
}


