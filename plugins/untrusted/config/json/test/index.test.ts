import { describe, it, expect } from 'vitest';
import json from '../src/index';

describe('json config plugin', () => {
  it('declares its name and extensions', () => {
    expect(json.name).toBe('json');
    expect(json.extensions).toEqual(['.json']);
  });

  it('parses a JSON object', async () => {
    const result = await json.runConfig(`{ "value": 99, "nested": { "list": [1, 2, 3] } }`);
    expect(result).toEqual({ value: 99, nested: { list: [1, 2, 3] } });
  });

  it('throws on malformed JSON', async () => {
    await expect(json.runConfig(`{ value: 99 }`)).rejects.toThrow();
  });
});
