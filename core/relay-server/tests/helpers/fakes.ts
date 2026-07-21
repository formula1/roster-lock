// Minimal, hand-rolled stand-ins for the Cloudflare Durable Object runtime -
// just enough of DurableObjectStorage/WebSocket's shape for Room's logic to
// run under plain Node/vitest, no Miniflare/wrangler required. Mirrors the
// spirit of match-agent's tests/integration/helpers (fake the network/runtime
// boundary, run the real protocol code against it).

export class FakeTxn {
  constructor(private data: Map<string, any>){}
  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key);
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }
}

// Real Durable Object storage transactions are serialized (a DO only ever
// runs one JS turn at a time) - this queues transactions FIFO on a promise
// chain so concurrent-looking `Promise.all([...])` calls in tests interleave
// the same way they would against the real thing, rather than racing on a
// shared Map.
export class FakeStorage {
  private data = new Map<string, any>();
  private queue: Promise<any> = Promise.resolve();
  private alarmTime: number | null = null;
  private alarmTimer: ReturnType<typeof setTimeout> | null = null;
  private alarmHandler: (() => void) | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key);
  }
  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }
  async deleteAll(): Promise<void> {
    this.data.clear();
  }
  transaction<T>(cb: (txn: FakeTxn) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => cb(new FakeTxn(this.data)));
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
  // Room only ever calls setAlarm once mid-flight; only one can be pending at
  // a time (matches the real Durable Object alarms contract) - a later call
  // replaces the earlier one, same as Cloudflare's actual behavior.
  async setAlarm(time: number | Date): Promise<void> {
    const ms = time instanceof Date ? time.getTime() : time;
    this.alarmTime = ms;
    if(this.alarmTimer) clearTimeout(this.alarmTimer);
    this.alarmTimer = setTimeout(() => this.alarmHandler?.(), Math.max(0, ms - Date.now()));
  }
  async deleteAlarm(): Promise<void> {
    this.alarmTime = null;
    if(this.alarmTimer){
      clearTimeout(this.alarmTimer);
      this.alarmTimer = null;
    }
  }
  getAlarm(): number | null {
    return this.alarmTime;
  }
  // Wires the DO's real alarm() method to actually fire when the scheduled
  // time elapses, instead of tests needing to reach in and call it manually -
  // this is what makes a short, test-only timeoutLength (see helpers/room.ts)
  // actually exercise the real scheduling path end to end.
  onAlarm(handler: () => void){
    this.alarmHandler = handler;
  }
}

export type FakeAttachment = {
  userId: string;
  publicKey: string;
  connectedAt: string;
};

export class FakeWebSocket {
  public sentRaw: Array<string> = [];
  public closed: { code: number, reason: string } | null = null;
  private attachment: FakeAttachment | null;
  private onSendHandler: ((data: string) => void) | null = null;
  private closeResolvers: Array<(closed: { code: number, reason: string }) => void> = [];

  constructor(attachment: FakeAttachment){
    this.attachment = attachment;
  }
  // Routes outgoing (DO -> client) messages into whatever is listening -
  // in tests, a real MessageBridge standing in for match-agent's roomBridge.
  onSend(handler: (data: string) => void){
    this.onSendHandler = handler;
  }
  send(data: string){
    // Mirrors the real Cloudflare WebSocket: sending on a closed socket throws
    // (this is exactly what surfaced as "Failed to send download-progress to a
    // socket TypeError: Can't call WebSocket send() after close()." in prod logs).
    if(this.closed) throw new Error("Can't call WebSocket send() after close().");
    this.sentRaw.push(data);
    this.onSendHandler?.(data);
  }
  close(code: number, reason: string){
    this.closed = { code, reason };
    for(const resolve of this.closeResolvers.splice(0)) resolve(this.closed);
  }
  // The DO's own completion/failure handling (refreshTimeout, completeRoom/
  // failRoom, DB + webhook calls) all happen *after* the message that earned
  // it returns control - room.webSocketMessage is invoked fire-and-forget
  // from the test harness's bridge wiring, so there's no promise a test can
  // just await to know "the room is fully done." This is the concrete,
  // externally-observable signal to wait on instead of an arbitrary delay.
  waitForClose(): Promise<{ code: number, reason: string }> {
    if(this.closed) return Promise.resolve(this.closed);
    return new Promise((resolve) => this.closeResolvers.push(resolve));
  }
  serializeAttachment(data: FakeAttachment){
    this.attachment = data;
  }
  deserializeAttachment(){
    return this.attachment;
  }
}

export class FakeDurableObjectState {
  public storage = new FakeStorage();
  private sockets: Array<FakeWebSocket> = [];

  addSocket(ws: FakeWebSocket){
    this.sockets.push(ws);
  }
  getWebSockets(): Array<any> {
    return this.sockets;
  }
}
