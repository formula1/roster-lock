// relay-server-cf's TimeoutController persists timeouts into Durable Object
// storage and reschedules a single alarm, purely to survive hibernation
// between messages. An always-on in-memory process never hibernates, so a
// room's timeouts are just plain setTimeout handles keyed by id.
export class RoomTimeouts {
  private timers = new Map<string, NodeJS.Timeout>();

  set(id: string, ms: number, fn: () => void) {
    this.clear(id);
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms));
  }

  clear(id: string) {
    const timer = this.timers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(id);
  }

  clearAll() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
