import { describe, it, expect } from 'vitest';
import { runLuaScript } from '../src/run-script';

function makeGlobals(modules: Record<string, unknown> = {}) {
  return {
    randomFloat: () => 0.5,
    randomInt: (min: number) => min,
    shuffleIndexes: (length: number) => Array.from({ length }, (_, i) => i),
    getPieceMeta: (_type: string, id: string) => ({ id }),
    getAvailablePieces: () => [] as string[],
    // Return JS objects synchronously so wasmoon doesn't stall awaiting a Promise
    requireScript: (path: string, _runCode: unknown) => {
      const result = modules[path];
      if (result === undefined) throw new Error(`Module not found: ${path}`);
      return result;
    },
  } as any;
}

const basicInput = {
  type: 'piece-user-validation' as const,
  pieceType: 'character',
  userId: 'user1',
  input: [],
};

describe('runLuaScript', () => {
  it('runs a basic script and returns a value', async () => {
    const script = `function main() return 42 end`;
    const result = await runLuaScript(makeGlobals(), basicInput, script, 'main');
    expect(result).toBe(42);
  });

  it('imports a module via require', async () => {
    const modules = { './module.lua': { value: 99 } };
    const script = `
      local mod = require("./module.lua")
      function main()
        return mod.value
      end
    `;
    const result = await runLuaScript(makeGlobals(modules), basicInput, script, 'main');
    expect(result).toBe(99);
  });

  it('throws when a required module is not found', async () => {
    const script = `
      local mod = require("./missing.lua")
      function main() return mod.value end
    `;
    await expect(
      runLuaScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow('Module not found: ./missing.lua');
  });

  it('throws when the initial method is not defined', async () => {
    const script = `function notMain() return 1 end`;
    await expect(
      runLuaScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow('No main function defined in script');
  });

  it('blocks filesystem access (io is nil)', async () => {
    const script = `
      function main()
        if io == nil then return "blocked" end
        return "not blocked"
      end
    `;
    const result = await runLuaScript(makeGlobals(), basicInput, script, 'main');
    expect(result).toBe('blocked');
  });

  it('enforces the gas limit on infinite loops', async () => {
    const script = `function main() while true do end end`;
    await expect(
      runLuaScript(makeGlobals(), basicInput, script, 'main')
    ).rejects.toThrow();
  });
});
