import { describe, it, expect, vi, beforeEach } from 'vitest';
import Git_Handler from '../src/index';
import git from 'isomorphic-git';

vi.mock('isomorphic-git', () => ({
  default: { clone: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('isomorphic-git/http/node', () => ({ default: {} }));
vi.mock('node:fs', () => ({ promises: {} }));

function makeProcessHandlers(extra: Record<string, unknown> = {}) {
  return {
    abortSignal: new AbortController().signal,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  git.clone.mockResolvedValue(undefined);
});

describe('validateURL', () => {
  it('accepts https git URLs ending in .git', () => {
    expect(Git_Handler.validateURL('https://github.com/user/repo.git')).toBe(true);
  });

  it('accepts https git URLs with a branch ref', () => {
    expect(Git_Handler.validateURL('https://github.com/user/repo.git#main')).toBe(true);
  });

  it('accepts http://localhost git URLs', () => {
    expect(Git_Handler.validateURL('http://localhost/repo.git')).toBe(true);
  });

  it('accepts git+https git URLs', () => {
    expect(Git_Handler.validateURL('git+https://github.com/user/repo.git')).toBe(true);
  });

  it('accepts git+http://localhost git URLs', () => {
    expect(Git_Handler.validateURL('git+http://localhost/repo.git')).toBe(true);
  });

  it('rejects git+http on non-localhost', () => {
    expect(() => Git_Handler.validateURL('git+http://github.com/user/repo.git')).toThrow('Git URL must use https://');
  });

  it('rejects http on non-localhost', () => {
    expect(() => Git_Handler.validateURL('http://github.com/user/repo.git')).toThrow('Git URL must use https://');
  });

  it('rejects URLs without .git suffix', () => {
    expect(() => Git_Handler.validateURL('https://github.com/user/repo')).toThrow('.git');
  });

  it('rejects URLs with no repository path', () => {
    expect(() => Git_Handler.validateURL('https://github.com')).toThrow('repository path');
  });
});

describe('download', () => {
  it('clones the repository and resolves with metaData', async () => {
    const result = await Git_Handler.download(
      'https://github.com/user/repo.git', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(result.metaData).toMatchObject({ url: 'https://github.com/user/repo.git', ref: 'main' });
    expect(git.clone).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://github.com/user/repo.git',
      dir: '/dest',
      depth: 1,
      singleBranch: true,
    }));
  });

  it('strips the git+ prefix before cloning', async () => {
    const result = await Git_Handler.download(
      'git+https://github.com/user/repo.git', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(git.clone).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://github.com/user/repo.git',
    }));
  });

  it('uses the ref from the URL fragment', async () => {
    const result = await Git_Handler.download(
      'https://github.com/user/repo.git#develop', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    expect(result.metaData).toMatchObject({ ref: 'develop' });
    expect(git.clone).toHaveBeenCalledWith(expect.objectContaining({ ref: 'develop' }));
  });

  it('includes credentials from URL in onAuth', async () => {
    const result = await Git_Handler.download(
      'https://user:token@github.com/user/repo.git', '/dest', makeProcessHandlers() as any
    );
    await result.finishPromise;

    const { onAuth } = git.clone.mock.calls[0][0];
    expect(onAuth()).toEqual({ username: 'user', password: 'token' });
  });

  it('rejects when git.clone throws', async () => {
    git.clone.mockRejectedValueOnce(new Error('Network unreachable'));

    const result = await Git_Handler.download(
      'https://github.com/user/repo.git', '/dest', makeProcessHandlers() as any
    );
    await expect(result.finishPromise).rejects.toThrow();
  });

  it('rejects immediately when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      Git_Handler.download('https://github.com/user/repo.git', '/dest', {
        abortSignal: ac.signal,
      } as any)
    ).rejects.toThrow('Download aborted');
  });
});
