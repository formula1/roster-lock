import net from 'node:net';
import dgram from 'node:dgram';

const MAX_PORT_DISCOVERY_ATTEMPTS = 10;

// webtorrent's ConnPool binds a TCP listener, then reuses that exact port
// number for its uTP (UDP) listener, so peers only need one port for both.
// The OS only guarantees a port is free for the protocol you actually ask
// it for. UDP is the scarcer resource on a typical dev machine (WebRTC,
// mDNS/avahi, other local services all grab random UDP ports), so we ask
// the OS for a free UDP port first and then just verify TCP also happens
// to be free there — checking the less-contested protocol second means
// fewer retries than gambling on TCP-then-UDP.
export async function findTorrentPort(attempts = MAX_PORT_DISCOVERY_ATTEMPTS): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const port = await probeFreeUdpPort();
    if (await isTcpPortFree(port)) return port;
  }
  throw new Error(`Could not find a free TCP+UDP port for the torrent client after ${attempts} attempts`);
}

function probeFreeUdpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.unref();
    socket.once('error', reject);
    socket.bind(0, () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

function isTcpPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}
