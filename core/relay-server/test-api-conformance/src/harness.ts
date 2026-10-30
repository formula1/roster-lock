// Config the suite hands every implementation so they all get bootstrapped
// with the same admin credentials/secrets and can be asserted against
// identically - no adapter-specific fixtures leaking into the shared suite.
export type RelayHarnessConfig = {
  jwtSecret: string;
  gameCoordinatorEncryptionKey: string;
  initialAdmin: { username: string; password: string };
};

// What every relay-server implementation (cloudflare, single-host, and any
// future one - e.g. a redis/postgres-backed cluster node) needs to provide
// to run the conformance suite against it: a real HTTP/WS endpoint, reached
// exactly the way a real client would. Nothing here is allowed to know how
// the implementation is built.
export interface RelayHarness {
  start(config: RelayHarnessConfig): Promise<{ baseUrl: string }>;
  stop(): Promise<void>;
}
