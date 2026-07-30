import { describe, it, expect } from 'vitest';
import json5 from '../src/index';

describe('json5 config plugin', () => {
  it('declares its name and extensions', () => {
    expect(json5.name).toBe('json5');
    expect(json5.extensions).toEqual(['.json5']);
  });

  it('parses json5 with comments, unquoted keys, and trailing commas', async () => {
    const result = await json5.runConfig(`{
      // the piece's base value
      value: 99,
      nested: { list: [1, 2, 3,], },
    }`);
    expect(result).toEqual({ value: 99, nested: { list: [1, 2, 3] } });
  });

  it('throws on malformed json5', async () => {
    await expect(json5.runConfig(`{ value: `)).rejects.toThrow();
  });
});
