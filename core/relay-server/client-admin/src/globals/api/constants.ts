
export const API_URL = new URL(window.location.origin);
API_URL.pathname = '/api/v1';

export type Auth = { authToken: string };
