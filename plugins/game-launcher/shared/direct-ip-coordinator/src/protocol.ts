// Plain TCP, newline-delimited JSON - no dependency beyond node:net. One
// coordinator instance can rendezvous multiple concurrent rooms, keyed by
// roomKey (the relay room id - see StartGameArgs.relayRoomId).

export type HostRegisterMessage = {
  role: "host",
  roomKey: string,
  listenPort: number,
  // The host's own view of its non-internal IPv4 addresses (see
  // localAddress.ts) - lets the coordinator hand a same-network client a
  // real LAN address instead of routing through whatever's reachable
  // outside it. Always present (possibly empty) rather than optional, so a
  // caller can't accidentally omit it and silently lose LAN preference.
  localAddresses: Array<string>,
};

export type ClientRegisterMessage = {
  role: "client",
  roomKey: string,
};

export type RegisterMessage = HostRegisterMessage | ClientRegisterMessage;

export type HostAddressMessage = {
  ip: string,
  port: number,
};

export function encodeMessage(message: unknown): string {
  return JSON.stringify(message) + "\n";
}

// Splits a growing byte buffer on newlines, returning complete lines and the
// unconsumed remainder - callers append each socket "data" chunk's decoded
// text and keep the remainder for the next chunk, since a single write on
// either end has no guaranteed relationship to TCP packet boundaries.
export function splitLines(buffer: string): { lines: Array<string>, remainder: string } {
  const parts = buffer.split("\n");
  const remainder = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim().length > 0), remainder };
}
