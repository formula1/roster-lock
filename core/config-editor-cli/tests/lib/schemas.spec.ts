import { describe, it, expect } from "vitest";
import { pieceDefinitionSchema, pieceOverridesSchema, selectionOverridesSchemas } from "../../src/lib/schemas";

describe("pieceDefinitionSchema", () => {
  const valid = {
    selectionStrategy: "mandatory",
    requires: [],
    pathVariables: ["skin"],
    assets: [{ name: "sprite", classification: "media", count: 1, glob: ["*.png"] }],
  };

  it("accepts a well-formed piece definition", () => {
    expect(pieceDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it("accepts count as '*' or a [min, max] range", () => {
    expect(() => pieceDefinitionSchema.parse({ ...valid, assets: [{ ...valid.assets[0], count: "*" }] })).not.toThrow();
    expect(() => pieceDefinitionSchema.parse({ ...valid, assets: [{ ...valid.assets[0], count: [1, "*"] }] })).not.toThrow();
  });

  it("rejects an invalid selectionStrategy", () => {
    expect(() => pieceDefinitionSchema.parse({ ...valid, selectionStrategy: "bogus" })).toThrow();
  });

  it("rejects unknown top-level properties", () => {
    expect(() => pieceDefinitionSchema.parse({ ...valid, extra: true })).toThrow();
  });

  it("rejects an asset missing required fields", () => {
    expect(() => pieceDefinitionSchema.parse({ ...valid, assets: [{ name: "sprite" }] })).toThrow();
  });
});

describe("pieceOverridesSchema", () => {
  it("accepts a fully-populated overrides object", () => {
    const input = {
      humanInfo: { name: "Blue", author: "author", url: "https://example.com", image: "https://example.com/i.png" },
      downloadSources: ["https://example.com/blue.tar"],
      pathVariables: { skin: "blue" },
    };
    expect(pieceOverridesSchema.parse(input)).toEqual(input);
  });

  it("accepts an empty object (all fields optional)", () => {
    expect(pieceOverridesSchema.parse({})).toEqual({});
  });

  it("rejects humanInfo missing a required field", () => {
    expect(() => pieceOverridesSchema.parse({ humanInfo: { name: "Blue" } })).toThrow();
  });

  it("rejects non-string pathVariables values", () => {
    expect(() => pieceOverridesSchema.parse({ pathVariables: { skin: 1 } })).toThrow();
  });
});

describe("selectionOverridesSchemas", () => {
  it("normal accepts validation and mergeAlgorithm", () => {
    const input = {
      validation: { count: "*", unique: false, banList: [], customValidation: [] },
      mergeAlgorithm: { src: "merge.ts" },
    };
    expect(() => selectionOverridesSchemas.normal.parse(input)).not.toThrow();
  });

  it("normal rejects a 'pieces' field (that's preselected-only)", () => {
    expect(() => selectionOverridesSchemas.normal.parse({ pieces: [] })).toThrow();
  });

  it("preselected accepts a pieces list, including nested required pieces", () => {
    const input = {
      pieces: [{ id: "@a/b", required: { minion: { mandatory: [], selectable: [] } } }],
    };
    expect(() => selectionOverridesSchemas.preselected.parse(input)).not.toThrow();
  });

  it("unselectable and game-controlled only accept pieceMeta", () => {
    expect(() => selectionOverridesSchemas.unselectable.parse({})).not.toThrow();
    expect(() => selectionOverridesSchemas.unselectable.parse({ pieces: [] })).toThrow();
    expect(() => selectionOverridesSchemas["game-controlled"].parse({})).not.toThrow();
  });
});
