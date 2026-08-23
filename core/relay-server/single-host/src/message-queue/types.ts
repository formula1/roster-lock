export type Unsubscribe = () => void;

// A relay deployment can run as several horizontally-scaled processes; this
// is the plumbing between them - a distributed, renewable key claim (who
// owns what) plus pub/sub (fan a message out to every process, let each
// self-filter against what it owns). It carries no relay/room semantics of
// its own - callers invent their own key and channel naming conventions on
// top (e.g. "controller:<roomId>" or "conn:<roomId>:<userId>" as claim keys).
export interface IMessageQueue {
  // Claims `key` for `ownerId` if it's unclaimed, or renews it if `ownerId`
  // already holds it. Returns false if another owner currently holds it.
  // `ttlMs` bounds how long the claim survives without being renewed via
  // another claim() call - the caller must reclaim on this cadence to stay
  // the owner, so a crashed owner's claim frees up on its own rather than
  // needing a release.
  claim(key: string, ownerId: string, ttlMs: number): Promise<boolean>;

  // Current owner of `key`, or null if unclaimed (including expired).
  getOwner(key: string): Promise<string | null>;

  // Releases `key`, but only if `ownerId` still holds it - a stale release
  // from an owner that already lost (or was never given) the claim is a
  // no-op rather than clobbering whoever holds it now.
  release(key: string, ownerId: string): Promise<void>;

  // Fans `message` out to every current subscriber of `channel`, across
  // every process sharing this queue. At-most-once, no history: a
  // subscriber only sees messages published while it's subscribed.
  publish(channel: string, message: unknown): Promise<void>;

  // Registers `handler` for every message published to `channel` (from any
  // process, including this one). Resolves once the subscription is
  // actually in effect - a message published after that point is guaranteed
  // to be seen. Returns a function to unsubscribe.
  subscribe(channel: string, handler: (message: unknown) => void): Promise<Unsubscribe>;

  // Releases all resources held by this queue instance (connections,
  // timers) - call once when a process is shutting down.
  close(): Promise<void>;
}
