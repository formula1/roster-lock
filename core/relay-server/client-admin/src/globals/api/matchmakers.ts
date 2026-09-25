import { addAuthHeader, handleFetch, replaceParams } from "../../utils/fetch";
import { API_URL, Auth } from "./constants";

type MatchMaker = {
  id: string;
  name: string;
  public_key: string;
  registered_at: string;
  status: 'active' | 'suspended';
  updated_at: string;
}

type MatchMakerStats = {
  total_rooms: number;
  active_rooms: number;
  successful_rooms: number;
  failed_rooms: number;
  avg_lifetime_seconds: number;
}

const PATHS = {
  root: '/matchmakers',
  item: '/matchmakers/:matchMakerId',
}

export const MATCHMAKER_API = {
  create: async ({ authToken }: Auth, body: { name: string, publicKey: string }) => {
    const CREATE_ENDPOINT = new URL(API_URL.pathname + PATHS.root, API_URL);
    return await handleFetch(fetch(
      CREATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )) as { id: string, name: string, publicKey: string };
  },
  list: async ({ authToken }: Auth) => {
    const LIST_ENDPOINT = new URL(API_URL.pathname + PATHS.root, API_URL);
    return await handleFetch(fetch(
      LIST_ENDPOINT,
      addAuthHeader(authToken)
    )) as MatchMaker[];
  },
  get: async ({ authToken }: Auth, { matchMakerId }: { matchMakerId: string }) => {
    const GET_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item, { matchMakerId }),
      API_URL
    );
    return await handleFetch(fetch(
      GET_ENDPOINT,
      addAuthHeader(authToken)
    )) as MatchMaker;
  },

  stats: async ({ authToken }: Auth, { matchMakerId }: { matchMakerId: string }) => {
    const STATS_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item + '/stats', { matchMakerId }),
      API_URL
    );
    return await handleFetch(fetch(
      STATS_ENDPOINT,
      addAuthHeader(authToken)
    )) as MatchMakerStats;
  },
  update: async (
    { authToken }: Auth,
    { matchMakerId }: { matchMakerId: string },
    body: { name: string, publicKey: string }
  ) => {
    const UPDATE_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item, { matchMakerId }),
      API_URL
    );
    return await handleFetch(fetch(
      UPDATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )) as { name: string, publicKey: string };
  },
  suspend: async ({ authToken }: Auth, { matchMakerId }: { matchMakerId: string }) => {
    const SUSPEND_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item + '/suspend', { matchMakerId }),
      API_URL
    );
    return await handleFetch(fetch(
      SUSPEND_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
      })
    )) as { success: boolean };
  },
  activate: async ({ authToken }: Auth, { matchMakerId }: { matchMakerId: string }) => {
    const ACTIVATE_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item + '/activate', { matchMakerId }),
      API_URL
    );
    return await handleFetch(fetch(
      ACTIVATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
      })
    )) as { success: boolean };
  },
}
