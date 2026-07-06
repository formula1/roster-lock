import { describe, it, expect } from 'vitest';
import { runTSScript } from '../src/run-script';

function makeGlobals(modules: Record<string, string> = {}) {
  return {
    randomFloat: () => 0.5,
    randomInt: (min: number) => min,
    shuffleIndexes: (length: number) => Array.from({ length }, (_, i) => i),
    getPieceMeta: (_type: string, id: string) => ({ id }),
    getAvailablePieces: () => [] as string[],
    // Return the module source synchronously so QuickJS can load it without
    // going through the Asyncify suspension path, which hangs in vitest threads.
    requireScript: (path: string, _runCode: unknown) => {
      const content = modules[path];
      if (content === undefined) throw new Error(`Module not found: ${path}`);
      return content;
    },
  } as any;
}

const basicInput = {
  type: 'piece-user-validation' as const,
  pieceType: 'character',
  userId: 'user1',
  input: [],
};

describe('runTSScript', () => {
  it('runs a basic script and returns a value', async () => {
    const script = `async function main() { return 42; }`;
    const result = await runTSScript(makeGlobals(), basicInput, script, 'main');
    expect(result).toBe(42);
  });

  it('imports a module via dynamic import', async () => {
    const modules = { 'module': `export const value = 99;` };
    const script = `
      async function main() {
        const { value } = await import("./module");
        return value;
      }
    `;
    const result = await runTSScript(makeGlobals(modules), basicInput, script, 'main');
    expect(result).toBe(99);
  });

  it('throws when a required module is not found', async () => {
    const script = `
      async function main() {
        const mod = await import("./missing");
        return mod.value;
      }
    `;
    await expect(
      runTSScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow('Module not found: missing');
  });

  it('throws when the initial method is not defined', async () => {
    const script = `async function notMain() { return 1; }`;
    await expect(
      runTSScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow('No main function defined in script');
  });

  it('enforces the cycle limit on infinite loops', async () => {
    const script = `async function main() { while (true) {} }`;
    await expect(
      runTSScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow();
  });

  it('uses our RNG for Math.random', async () => {
    const script = `async function main() { return Math.random(); }`;
    const result = await runTSScript(makeGlobals(), basicInput, script, 'main');
    expect(result).toBe(0.5);
  });

  it('completes when main finishes even with unresolved pending background jobs', async () => {
    const script = `
      async function background() {
        await new Promise(() => {}); // never resolves
      }
      async function main() {
        background(); // fire and forget
        return 'done';
      }
    `;
    const result = await runTSScript(makeGlobals(), basicInput, script, 'main');
    expect(result).toBe('done');
  });
});
