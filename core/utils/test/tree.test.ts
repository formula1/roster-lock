import { describe, it, expect } from 'vitest';
import { treeHasCycle, findAllCycles, getCyclesUsingKey } from '../src/tree';

function requiresFrom(graph: Record<string, Array<string>>){
  return (key: string) => graph[key] ?? [];
}

describe('treeHasCycle', () => {
  it('returns null for a linear chain with no cycle', () => {
    const graph = { a: ['b'], b: ['c'], c: [] };
    expect(treeHasCycle(['a', 'b', 'c'], requiresFrom(graph))).toBeNull();
  });

  it('returns null for isolated nodes with no dependencies', () => {
    const graph = { a: [], b: [] };
    expect(treeHasCycle(['a', 'b'], requiresFrom(graph))).toBeNull();
  });

  it('returns null for a diamond dependency graph', () => {
    const graph = { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] };
    expect(treeHasCycle(['a', 'b', 'c', 'd'], requiresFrom(graph))).toBeNull();
  });

  it('detects a direct two-node cycle', () => {
    const graph = { a: ['b'], b: ['a'] };
    expect(treeHasCycle(['a', 'b'], requiresFrom(graph))).toEqual(['a', 'b', 'a']);
  });

  it('detects a node that requires itself', () => {
    const graph = { a: ['a'] };
    expect(treeHasCycle(['a'], requiresFrom(graph))).toEqual(['a', 'a']);
  });

  it('finds a cycle even when unrelated cycle-free nodes are checked first', () => {
    const graph = { x: [], a: ['b'], b: ['a'] };
    expect(treeHasCycle(['x', 'a', 'b'], requiresFrom(graph))).toEqual(['a', 'b', 'a']);
  });

  it('throws when a dependency is missing from the key list', () => {
    const graph = { a: ['z'] };
    expect(() => treeHasCycle(['a'], requiresFrom(graph))).toThrow('Missing required z for a');
  });
});

describe('findAllCycles', () => {
  it('returns an empty array for a cycle-free graph', () => {
    const graph = { a: ['b'], b: ['c'], c: [] };
    expect(findAllCycles(['a', 'b', 'c'], requiresFrom(graph))).toEqual([]);
  });

  it('rotates a cycle so it starts and ends at the repeated node, dropping any non-cyclic prefix', () => {
    // a -> b -> c -> b : the cycle is only b <-> c, "a" is just a path leading into it
    const graph = { a: ['b'], b: ['c'], c: ['b'] };
    expect(findAllCycles(['a', 'b', 'c'], requiresFrom(graph))).toEqual([['b', 'c', 'b']]);
  });

  it('finds multiple independent cycles', () => {
    const graph = { a: ['b'], b: ['a'], c: ['d'], d: ['c'] };
    expect(findAllCycles(['a', 'b', 'c', 'd'], requiresFrom(graph))).toEqual([
      ['a', 'b', 'a'],
      ['c', 'd', 'c'],
    ]);
  });

  it('throws when a dependency is missing from the key list', () => {
    const graph = { a: ['z'] };
    expect(() => findAllCycles(['a'], requiresFrom(graph))).toThrow('Missing required z for a');
  });
});

describe('getCyclesUsingKey', () => {
  const cycles = [['a', 'b', 'c', 'a'], ['x', 'y', 'x']];

  it('returns an empty array when the key is in no cycle', () => {
    expect(getCyclesUsingKey('q', cycles)).toEqual([]);
  });

  it('returns the cycle unchanged when the key is already its start/end', () => {
    expect(getCyclesUsingKey('a', cycles)).toEqual([['a', 'b', 'c', 'a']]);
  });

  it('rotates the cycle so the key becomes the start and end', () => {
    expect(getCyclesUsingKey('b', cycles)).toEqual([['b', 'c', 'a', 'b']]);
    expect(getCyclesUsingKey('c', cycles)).toEqual([['c', 'a', 'b', 'c']]);
  });

  it('ignores cycles that do not contain the key', () => {
    expect(getCyclesUsingKey('y', cycles)).toEqual([['y', 'x', 'y']]);
  });

  it('rotates each matching cycle independently when several contain the key', () => {
    const multi = [['a', 'b', 'a'], ['c', 'a', 'd', 'c']];
    expect(getCyclesUsingKey('a', multi)).toEqual([
      ['a', 'b', 'a'],
      ['a', 'd', 'c', 'a'],
    ]);
  });

  it('composes with findAllCycles to isolate the cycles touching one node', () => {
    const graph = { a: ['b'], b: ['a'], c: ['d'], d: ['c'] };
    const all = findAllCycles(['a', 'b', 'c', 'd'], requiresFrom(graph));
    expect(getCyclesUsingKey('a', all)).toEqual([['a', 'b', 'a']]);
    expect(getCyclesUsingKey('c', all)).toEqual([['c', 'd', 'c']]);
  });
});
