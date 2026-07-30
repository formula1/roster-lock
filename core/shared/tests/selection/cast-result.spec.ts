import { describe, it, expect } from "vitest";

import { castSharedResult, castPersonalResult } from "../../src/match-lock-file/match-config/version-1/usage/validate-select/selection-types/normal/cast-result.js";

function validPiece() {
  return {
    id: "@author/blue",
    required: {
      character: {
        mandatory: [
          {
            id: "@author/red",
            required: {},
          },
        ],
        selectable: [],
      },
    },
  };
}

describe("castSharedResult", () => {
  it("accepts a SelectedPiece with required keyed by piece type", () => {
    const value = [validPiece()];
    expect(() => castSharedResult(value)).not.toThrow();
    expect(castSharedResult(value)).toEqual(value);
  });

  it("accepts a piece with no required entries", () => {
    const value = [{ id: "@author/blue", required: {} }];
    expect(() => castSharedResult(value)).not.toThrow();
  });

  it("rejects required.mandatory/selectable placed directly on the piece instead of under a piece-type key", () => {
    const value = [{
      id: "@author/blue",
      required: { mandatory: [], selectable: [] },
    }];
    expect(() => castSharedResult(value)).toThrow();
  });

  it("rejects a piece missing an id", () => {
    const value = [{ required: {} }];
    expect(() => castSharedResult(value)).toThrow();
  });

  it("rejects a piece-type entry missing mandatory/selectable", () => {
    const value = [{
      id: "@author/blue",
      required: { character: { mandatory: [] } },
    }];
    expect(() => castSharedResult(value)).toThrow();
  });

  it("rejects unknown properties on a piece", () => {
    const value = [{ id: "@author/blue", required: {}, extra: true }];
    expect(() => castSharedResult(value)).toThrow();
  });
});

describe("castPersonalResult", () => {
  it("accepts a map of user id to selected pieces", () => {
    const value = { user1: [validPiece()] };
    expect(() => castPersonalResult(value)).not.toThrow();
    expect(castPersonalResult(value)).toEqual(value);
  });

  it("rejects a user's selection containing an invalid piece", () => {
    const value = { user1: [{ id: "@author/blue", required: { mandatory: [], selectable: [] } }] };
    expect(() => castPersonalResult(value)).toThrow();
  });
});
