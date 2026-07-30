import { describe, it, expect } from 'vitest';
import { buildPieceIdToLogicId } from '../src/pieceIdToLogicId';

describe('buildPieceIdToLogicId', () => {
  it('maps each piece id in a roster to its current logic hash', () => {
    const lockConfig = {
      rosters: {
        character: [
          { id: 'ryu', version: { logic: 'hash-ryu-v1', media: 'media-ryu', docs: 'docs-ryu' } },
          { id: 'ken', version: { logic: 'hash-ken-v1', media: 'media-ken', docs: 'docs-ken' } },
        ],
        stage: [
          { id: 'dojo', version: { logic: 'hash-dojo-v1', media: 'media-dojo', docs: 'docs-dojo' } },
        ],
      },
    } as any;

    expect(buildPieceIdToLogicId(lockConfig, 'character')).toEqual({
      ryu: 'hash-ryu-v1',
      ken: 'hash-ken-v1',
    });
    expect(buildPieceIdToLogicId(lockConfig, 'stage')).toEqual({ dojo: 'hash-dojo-v1' });
  });

  it('returns an empty map for a pieceType absent from the roster', () => {
    const lockConfig = { rosters: {} } as any;
    expect(buildPieceIdToLogicId(lockConfig, 'character')).toEqual({});
  });
});
