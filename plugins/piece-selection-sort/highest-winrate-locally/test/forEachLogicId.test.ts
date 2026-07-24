import { describe, it, expect } from 'vitest';
import { forSelectedPieces } from '../src/forSelectedPieces';
import { forEachLogicId } from '../src/forEachLogicId';

const userSelections = {
  'user-a': {
    character: [{ id: 'ryu', required: {} }],
    stage: [{ id: 'dojo', required: {} }],
  },
  'user-b': {
    character: [{ id: 'ken', required: {} }],
  },
} as any;

describe('forSelectedPieces', () => {
  it('walks only the top-level picks of the given users', () => {
    const seen: Array<[string, string]> = [];
    forSelectedPieces(userSelections, ['user-a'], (pieceType, pieceId)=>{ seen.push([pieceType, pieceId]); });
    expect(seen).toEqual([['character', 'ryu'], ['stage', 'dojo']]);
  });

  it('skips users absent from userSelections', () => {
    const seen: Array<[string, string]> = [];
    forSelectedPieces(userSelections, ['user-a', 'ghost-user'], (pieceType, pieceId)=>{ seen.push([pieceType, pieceId]); });
    expect(seen).toEqual([['character', 'ryu'], ['stage', 'dojo']]);
  });
});

describe('forEachLogicId', () => {
  const lockConfig = {
    rosters: {
      character: [
        { id: 'ryu', version: { logic: 'hash-ryu', media: '', docs: '' } },
        { id: 'ken', version: { logic: 'hash-ken', media: '', docs: '' } },
      ],
      stage: [
        { id: 'dojo', version: { logic: 'hash-dojo', media: '', docs: '' } },
      ],
    },
  } as any;

  it('translates each selected pieceId to its current logicId', () => {
    const seen: Array<[string, string]> = [];
    forEachLogicId(lockConfig, userSelections, ['user-a', 'user-b'], (pieceType, logicId)=>{
      seen.push([pieceType, logicId]);
    });
    expect(seen).toEqual([['character', 'hash-ryu'], ['stage', 'hash-dojo'], ['character', 'hash-ken']]);
  });

  it('skips a selected piece missing from the roster instead of throwing', () => {
    const selections = { 'user-a': { character: [{ id: 'unknown-piece', required: {} }] } } as any;
    const seen: Array<[string, string]> = [];
    forEachLogicId(lockConfig, selections, ['user-a'], (pieceType, logicId)=>{ seen.push([pieceType, logicId]); });
    expect(seen).toEqual([]);
  });
});
