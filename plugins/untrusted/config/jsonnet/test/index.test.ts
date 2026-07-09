import { describe, it, expect } from 'vitest';
import jsonnet from '../src/index';

describe('jsonnet config plugin', () => {
  it('declares its name and extensions', () => {
    expect(jsonnet.name).toBe('jsonnet');
    expect(jsonnet.extensions).toEqual(['.jsonnet']);
  });

  it('evaluates a jsonnet snippet with comments and computation', async () => {
    const result = await jsonnet.runConfig(`{
      // jsonnet supports comments and computation
      value: 90 + 9,
      nested: { list: [1, 2, 3] },
    }`);
    expect(result).toEqual({ value: 99, nested: { list: [1, 2, 3] } });
  });

  it('throws on malformed jsonnet', async () => {
    await expect(jsonnet.runConfig(`{ value: `)).rejects.toThrow();
  });
});
