// This app is titled-room's own UI - unlike a host shell (which can point
// at an arbitrary match-agent), it's already deployed pointed at a specific
// auth/titled-room backend pair, so these are build-time config, not
// user-editable settings.
export const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || "http://localhost:8787";
export const TITLED_ROOM_URL = import.meta.env.VITE_TITLED_ROOM_URL || "http://localhost:8789";
