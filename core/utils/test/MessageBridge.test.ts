import { describe, it, expect, vi } from 'vitest';
import { MessageBridge } from '../src/MessageBridge';
import type { MessageBridgeMessage } from '../src/MessageBridge/types';

function wireBridges(debug = false): [MessageBridge, MessageBridge] {
  let b: MessageBridge;
  const a: MessageBridge = new MessageBridge((msg: MessageBridgeMessage) => b.handleMessage(msg), debug);
  b = new MessageBridge((msg: MessageBridgeMessage) => a.handleMessage(msg), debug);
  return [a, b];
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MessageBridge events', () => {
  it('delivers sendEvent payloads to onEvent listeners', async () => {
    const [a, b] = wireBridges();
    const received: any[] = [];
    b.onEvent('ping', (data) => received.push(data));

    a.sendEvent('ping', { hello: 'world' });
    await tick();

    expect(received).toEqual([{ hello: 'world' }]);
  });
});

describe('MessageBridge requests', () => {
  it('resolves sendRequest with the handler result', async () => {
    const [a, b] = wireBridges();
    b.onRequest('add', ({ x, y }) => x + y);

    await expect(a.sendRequest('add', { x: 2, y: 3 })).resolves.toBe(5);
  });

  it('rejects sendRequest with a real Error carrying the handler\'s message', async () => {
    const [a, b] = wireBridges();
    b.onRequest('boom', () => { throw new Error('nope'); });

    // The error crosses the bridge as a plain string (postMessage/WebSocket JSON can't carry a
    // real Error's prototype) - this asserts the receiving side rebuilds an Error from it rather
    // than rejecting with the bare string, since callers throughout the codebase read `.message`
    // off a sendRequest() rejection.
    await expect(a.sendRequest('boom', {})).rejects.toThrow('nope');
  });

  it('rejects sendRequest when there is no listener at the path', async () => {
    const [a] = wireBridges();

    await expect(a.sendRequest('missing', {})).rejects.toBeTruthy();
  });
});

describe('MessageBridge streams', () => {
  it('opens a stream and exchanges data both ways', async () => {
    const [a, b] = wireBridges();
    const serverReceived: any[] = [];

    b.onStream('echo', (stream) => {
      stream.onData((data) => {
        serverReceived.push(data);
        stream.sendData({ echoed: data });
      });
    });

    const clientReceived: any[] = [];
    const stream = a.sendStream('echo');
    stream.onData((data) => clientReceived.push(data));

    await stream.waitForOpen;
    stream.sendData('hello');
    await tick();

    expect(serverReceived).toEqual(['hello']);
    expect(clientReceived).toEqual([{ echoed: 'hello' }]);
  });

  it('invokes the onStream handler exactly once per stream', async () => {
    const [a, b] = wireBridges();
    const handler = vi.fn();
    b.onStream('once', handler);

    const stream = a.sendStream('once');
    await stream.waitForOpen;
    await tick();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('attaches the handler\'s listeners before the peer is allowed to send data', async () => {
    const [a, b] = wireBridges();
    const order: string[] = [];

    b.onStream('order', (stream) => {
      order.push('listener-attached');
      stream.onData(() => order.push('data-received'));
    });

    const stream = a.sendStream('order');
    await stream.waitForOpen;
    stream.sendData('go');
    await tick();

    expect(order).toEqual(['listener-attached', 'data-received']);
  });

  it('rejects waitForOpen when no listener exists at the path', async () => {
    const [a] = wireBridges();
    const stream = a.sendStream('missing');

    await expect(stream.waitForOpen).rejects.toBeTruthy();
  });

  it('lets the receiving side send data back without throwing', async () => {
    const [a, b] = wireBridges();

    b.onStream('greet', (stream) => {
      Promise.resolve().then(() => stream.sendData('hi from server'));
    });

    const received: any[] = [];
    const stream = a.sendStream('greet');
    stream.onData((data) => received.push(data));
    await stream.waitForOpen;
    await tick();

    expect(received).toEqual(['hi from server']);
  });

  it('throws a helpful error if sendData is called before the stream opens', () => {
    const [a] = wireBridges();
    const stream = a.sendStream('anything');
    stream.waitForOpen.catch(() => {}); // no listener registered; the open attempt is expected to fail

    expect(() => stream.sendData('too soon')).toThrow(/during setup/);
  });
});

describe('MessageBridge bridge (nested sessions)', () => {
  it('establishes a nested bridge and supports request/response over it', async () => {
    const [a, b] = wireBridges();

    b.onBridge('session', (session) => {
      session.onRequest('whoami', () => 'server');
    });

    const bridgeRequest = a.sendBridge('session');
    await bridgeRequest.waitForOpen;

    await expect(bridgeRequest.sendRequest('whoami', {})).resolves.toBe('server');
  });

  it('destroys the nested session when the underlying stream ends', async () => {
    const [a, b] = wireBridges();
    let destroyedSession: any = null;

    b.onBridge('session', (session) => {
      destroyedSession = session;
    });

    const bridgeRequest = a.sendBridge('session');
    await bridgeRequest.waitForOpen;
    await tick();

    bridgeRequest.sendEnd();
    await tick();

    expect(() => destroyedSession.sendRequest('anything', {})).toThrow(/destroyed/);
  });
});
