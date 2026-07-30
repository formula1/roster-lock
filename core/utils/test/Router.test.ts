import { describe, it, expect, vi } from 'vitest';
import { GenericRouter, GenericRouterCallbackArg } from '../src/Router';

type FakeRequest = { method: string, url: string };

function createRouter(config?: { mergeParams?: boolean }){
  return new GenericRouter<FakeRequest>(
    (request) => new URL(request.url, "ws://localhost:80"),
    (request) => request.method,
    config,
  );
}

class MethodRouter extends GenericRouter<FakeRequest> {
  get(path: string, ...callbacks: Array<GenericRouterCallbackArg<FakeRequest>>){
    return this.addHandler("GET", path, false, ...callbacks);
  }
  post(path: string, ...callbacks: Array<GenericRouterCallbackArg<FakeRequest>>){
    return this.addHandler("POST", path, false, ...callbacks);
  }
}

function handle(router: GenericRouter<FakeRequest>, request: FakeRequest): Promise<any>{
  return new Promise((resolve) => {
    router.handleRequest(request, (err) => resolve(err));
  });
}

describe('GenericRouter matching', () => {
  it('matches an exact path and passes captured params', async () => {
    const router = createRouter();
    const seen: any[] = [];
    router.all('/users/:id', (request, info, next) => {
      seen.push(info.params);
      next();
    });

    const err = await handle(router, { method: 'GET', url: '/users/42' });

    expect(err).toBeUndefined();
    expect(seen).toEqual([{ id: '42' }]);
  });

  it('captures multiple params across segments', async () => {
    const router = createRouter();
    const seen: any[] = [];
    router.all('/users/:userId/posts/:postId', (request, info, next) => {
      seen.push(info.params);
      next();
    });

    await handle(router, { method: 'GET', url: '/users/1/posts/99' });

    expect(seen).toEqual([{ userId: '1', postId: '99' }]);
  });

  it('does not match when the path has extra trailing segments', async () => {
    const router = createRouter();
    const handler = vi.fn((request, info, next) => next());
    router.all('/users', handler);

    const err = await handle(router, { method: 'GET', url: '/users/42' });

    expect(handler).not.toHaveBeenCalled();
    expect(err).toBeUndefined();
  });

  it('calls the final callback with no error when nothing matches', async () => {
    const router = createRouter();
    router.all('/known', (request, info, next) => next());

    const err = await handle(router, { method: 'GET', url: '/unknown' });

    expect(err).toBeUndefined();
  });

  it('runs matching handlers in registration order', async () => {
    const router = createRouter();
    const order: string[] = [];
    router.all('/x', (request, info, next) => { order.push('first'); next(); });
    router.all('/x', (request, info, next) => { order.push('second'); next(); });

    await handle(router, { method: 'GET', url: '/x' });

    expect(order).toEqual(['first', 'second']);
  });

  it('stops routing once a handler never calls next', async () => {
    const router = createRouter();
    const after = vi.fn((request, info, next) => next());
    router.all('/x', () => { /* never calls next: request considered handled */ });
    router.all('/x', after);

    const callback = vi.fn();
    router.handleRequest({ method: 'GET', url: '/x' }, callback);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(after).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('GenericRouter method filtering', () => {
  it('only invokes handlers registered for the matching method', async () => {
    const router = new MethodRouter(
      (request) => new URL(request.url, "ws://localhost:80"),
      (request) => request.method,
    );
    const getHandler = vi.fn((request, info, next) => next());
    const postHandler = vi.fn((request, info, next) => next());
    router.get('/thing', getHandler);
    router.post('/thing', postHandler);

    await handle(router, { method: 'POST', url: '/thing' });

    expect(postHandler).toHaveBeenCalledTimes(1);
    expect(getHandler).not.toHaveBeenCalled();
  });

  it('matches "*" handlers regardless of method', async () => {
    const router = createRouter();
    const handler = vi.fn((request, info, next) => next());
    router.all('/thing', handler);

    await handle(router, { method: 'DELETE', url: '/thing' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('GenericRouter error propagation', () => {
  it('short-circuits remaining handlers when next is called with an error', async () => {
    const router = createRouter();
    const after = vi.fn((request, info, next) => next());
    router.all('/x', (request, info, next) => next(new Error('nope')));
    router.all('/x', after);

    const err = await handle(router, { method: 'GET', url: '/x' });

    expect(err).toBeInstanceOf(Error);
    expect(after).not.toHaveBeenCalled();
  });

  it('propagates a synchronously thrown error to the final callback', async () => {
    const router = createRouter();
    router.all('/x', () => { throw new Error('boom'); });

    const err = await handle(router, { method: 'GET', url: '/x' });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('boom');
  });

  it('propagates a rejected async handler to the final callback', async () => {
    const router = createRouter();
    router.all('/x', async () => { throw new Error('async boom'); });

    const err = await handle(router, { method: 'GET', url: '/x' });

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('async boom');
  });

  it('warns instead of crashing when a callback is invoked more than once', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createRouter();
    router.all('/x', (request, info, next) => { next(); next(); });

    await handle(router, { method: 'GET', url: '/x' });

    expect(warn).toHaveBeenCalledWith("Callback called multiple times", expect.any(Number));
    warn.mockRestore();
  });
});

describe('GenericRouter nested routers via use()', () => {
  it('mounts a nested router and trims the matched prefix from the pathname', async () => {
    const router = createRouter();
    const sub = createRouter();
    const seen: any[] = [];
    sub.all('/hello', (request, info, next) => { seen.push(info.url.pathname); next(); });
    router.use('/api', sub);

    const err = await handle(router, { method: 'GET', url: '/api/hello' });

    expect(err).toBeUndefined();
    expect(seen).toEqual(['/hello']);
  });

  it('does not leak parent params into a nested router by default', async () => {
    const router = createRouter();
    const sub = createRouter();
    const seen: any[] = [];
    sub.all('/hello', (request, info, next) => { seen.push(info.params); next(); });
    router.use('/api/:tenantId', sub);

    await handle(router, { method: 'GET', url: '/api/acme/hello' });

    expect(seen).toEqual([{}]);
  });

  it('merges parent params into a nested router when mergeParams is set', async () => {
    const router = createRouter();
    const sub = createRouter({ mergeParams: true });
    const seen: any[] = [];
    sub.all('/hello/:name', (request, info, next) => { seen.push(info.params); next(); });
    router.use('/api/:tenantId', sub);

    await handle(router, { method: 'GET', url: '/api/acme/hello/sam' });

    expect(seen).toEqual([{ tenantId: 'acme', name: 'sam' }]);
  });
});
