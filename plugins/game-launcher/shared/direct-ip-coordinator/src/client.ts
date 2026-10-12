import { connect } from "node:net";
import { encodeMessage, splitLines, HostAddressMessage } from "./protocol";

// Spawning the host's game process is not the same as it being ready to
// accept a netplay connection - loading assets takes real time, and not
// every engine exposes an "I'm listening now" signal of its own. In
// principle probing the port directly (a real TCP connect, not a timer)
// closes that race properly - but ikemen-go's startGame tried gating
// registerAsHost on this and it made match-agent's /start request for the
// CLIENT (which blocks inside awaitHostAddress below) hang far longer than
// expected in practice, so it isn't wired into that plugin right now.
// Kept here, tested, for a caller whose engine's listen-socket timing is
// well enough understood to use it safely.
export function waitForLocalPortOpen(port: number, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for 127.0.0.1:${port} to start listening`));
        } else {
          setTimeout(attempt, 250);
        }
      });
    };
    attempt();
  });
}

// Called by the room host once its listen port is confirmed actually open
// (see waitForLocalPortOpen above - a caller may choose to gate on both
// together). Resolves once the coordinator has finished with this
// connection (served every expected client and closed it) - a best-effort
// signal, not something a caller needs to block a match that's already
// running on.
//
// localAddresses is required, not defaulted to an OS lookup in here, so
// this stays a pure function a test can call with a fixed value - a caller
// that wants real autodetection passes getLocalNetworkAddresses()
// explicitly (see localAddress.ts).
export function registerAsHost(
  coordinatorAddr: { host: string, port: number },
  info: { roomKey: string, listenPort: number, localAddresses: Array<string> },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(coordinatorAddr.port, coordinatorAddr.host, () => {
      socket.write(encodeMessage({
        role: "host", roomKey: info.roomKey, listenPort: info.listenPort, localAddresses: info.localAddresses,
      }));
    });
    socket.on("error", reject);
    socket.on("close", () => resolve());
  });
}

// Called by a joining client before it spawns the game. Blocks until the
// coordinator actually has a host address to hand back - this is the real
// ordering guarantee (enforced server-side, see server.ts), not a
// client-side guess about whether the host is ready yet.
//
// timeoutMs matters more here than it looks: for ikemen-go this call sits
// inside startGame, which match-agent's /start route awaits before
// responding - so a host that never registers (crashed, never reachable,
// coordinator hiccup) would otherwise hang that HTTP request forever with
// zero feedback, rather than failing loudly. Any other caller blocking a
// request on this should keep the same expectation in mind.
export function awaitHostAddress(
  coordinatorAddr: { host: string, port: number },
  roomKey: string,
  timeoutMs = 60_000,
): Promise<HostAddressMessage> {
  return new Promise((resolve, reject) => {
    const socket = connect(coordinatorAddr.port, coordinatorAddr.host, () => {
      socket.write(encodeMessage({ role: "client", roomKey }));
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for the host's address from the coordinator (room ${roomKey})`));
    }, timeoutMs);
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const { lines } = splitLines(buffer);
      const line = lines[0];
      if (!line) return;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(line) as HostAddressMessage);
      } catch (e) {
        reject(e as Error);
      } finally {
        socket.end();
      }
    });
    socket.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}
