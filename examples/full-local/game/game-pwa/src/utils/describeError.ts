import { HTTPError } from "@roster-lock/ts-client";

const RAW_JS_ERROR =
  /is not a function|Cannot read propert(y|ies) of|is not defined|is not iterable|Unexpected token|Unexpected end of JSON/;
const NETWORK_ERROR = /failed to fetch|networkerror|load failed|network request failed/i;

// A few known server-side error strings read better rephrased for a player
// rather than shown verbatim.
const KNOWN_SERVER_MESSAGES: Record<string, string> = {
  "Machine timed out": "Your opponent didn't connect in time. Try again.",
  "Total timed out": "The match took too long and was cancelled. Try again.",
};

/**
 * Turns a thrown error into something a player (not a developer) can act on.
 * Raw JS TypeErrors and network failures get replaced with `fallback` (the
 * original is still logged to console for debugging); HTTPError's server
 * message and any other explicitly-thrown Error are shown as-is, since
 * those are already written to be read by a user.
 */
export function humanizeServerMessage(message: string): string {
  return KNOWN_SERVER_MESSAGES[message] ?? message;
}

export function describeError(err: unknown, fallback: string): string {
  if (err instanceof HTTPError) {
    const serverMessage = typeof err.body?.error === "string" ? err.body.error : null;
    if (serverMessage) return humanizeServerMessage(serverMessage);
  }

  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return fallback;

  if (NETWORK_ERROR.test(message)) {
    return "Couldn't reach the server. Check that it's running and the URL is correct.";
  }
  if (RAW_JS_ERROR.test(message)) {
    console.error(err);
    return fallback;
  }
  return message;
}
