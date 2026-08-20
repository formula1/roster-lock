import { addAuthHeader, handleFetch, replaceParams } from "../../utils/fetch";
import { API_URL, Auth } from "./constants";

type GameCoordinator = {
  id: string;
  name: string;
  success_webhook_url: string;
  failure_webhook_url: string;
  api_key_preview: string;
  registered_at: string;
  status: 'active' | 'suspended';
  updated_at: string;
}

const PATHS = {
  root: '/game-coordinator',
  item: '/game-coordinator/:gameCoordinatorId',
}

export const GAME_COORDINATOR_API = {
  create: async (
    { authToken }: Auth,
    body: { id: string, name: string, successWebhookUrl: string, failureWebhookUrl: string, apiKey: string }
  ) => {
    const CREATE_ENDPOINT = new URL(API_URL.pathname + PATHS.root, API_URL);
    return await handleFetch(fetch(
      CREATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: body.id,
          name: body.name,
          success_webhook_url: body.successWebhookUrl,
          failure_webhook_url: body.failureWebhookUrl,
          api_key: body.apiKey,
        }),
      })
    )) as { id: string, name: string };
  },
  list: async ({ authToken }: Auth) => {
    const LIST_ENDPOINT = new URL(API_URL.pathname + PATHS.root, API_URL);
    return await handleFetch(fetch(
      LIST_ENDPOINT,
      addAuthHeader(authToken)
    )) as GameCoordinator[];
  },
  get: async ({ authToken }: Auth, { gameCoordinatorId }: { gameCoordinatorId: string }) => {
    const GET_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item, { gameCoordinatorId }),
      API_URL
    );
    return await handleFetch(fetch(
      GET_ENDPOINT,
      addAuthHeader(authToken)
    )) as GameCoordinator;
  },
  update: async (
    { authToken }: Auth,
    { gameCoordinatorId }: { gameCoordinatorId: string },
    body: { name: string, successWebhookUrl: string, failureWebhookUrl: string }
  ) => {
    const UPDATE_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item, { gameCoordinatorId }),
      API_URL
    );
    return await handleFetch(fetch(
      UPDATE_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: body.name,
          success_webhook_url: body.successWebhookUrl,
          failure_webhook_url: body.failureWebhookUrl,
        }),
      })
    )) as { success: boolean };
  },
  suspend: async ({ authToken }: Auth, { gameCoordinatorId }: { gameCoordinatorId: string }) => {
    const SUSPEND_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item + '/suspend', { gameCoordinatorId }),
      API_URL
    );
    return await handleFetch(fetch(
      SUSPEND_ENDPOINT,
      addAuthHeader(authToken, {
        method: 'PUT',
      })
    )) as { success: boolean };
  },
  activate: async ({ authToken }: Auth, { gameCoordinatorId }: { gameCoordinatorId: string }) => {
    const ACTIVATE_ENDPOINT = new URL(
      replaceParams(API_URL.pathname + PATHS.item + '/activate', { gameCoordinatorId }),
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
