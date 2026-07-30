import { describe, it, expect } from "vitest";
import { parseKeyValueList, parseCommaList, parseCount, parseStrategy } from "../../src/lib/parse";

describe("parseKeyValueList", () => {
  it("returns an empty object for undefined", () => {
    expect(parseKeyValueList(undefined)).toEqual({});
  });

  it("parses comma-separated key=value pairs", () => {
    expect(parseKeyValueList("a=1,b=2")).toEqual({ a: "1", b: "2" });
  });

  it("trims whitespace around pairs", () => {
    expect(parseKeyValueList(" a=1 , b=2 ")).toEqual({ a: "1", b: "2" });
  });

  it("skips empty segments", () => {
    expect(parseKeyValueList("a=1,,b=2")).toEqual({ a: "1", b: "2" });
  });

  it("allows '=' inside the value", () => {
    expect(parseKeyValueList("a=1=2")).toEqual({ a: "1=2" });
  });

  it("throws on a segment with no '='", () => {
    expect(() => parseKeyValueList("a=1,bad")).toThrow(/Invalid key=value pair/);
  });
});

describe("parseCommaList", () => {
  it("returns an empty array for undefined", () => {
    expect(parseCommaList(undefined)).toEqual([]);
  });

  it("splits and trims", () => {
    expect(parseCommaList(" a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries", () => {
    expect(parseCommaList("a,,b,")).toEqual(["a", "b"]);
  });
});

describe("parseCount", () => {
  it("parses '*' as-is", () => {
    expect(parseCount("*")).toBe("*");
  });

  it("parses a plain integer", () => {
    expect(parseCount("3")).toBe(3);
  });

  it("throws on a non-numeric plain value", () => {
    expect(() => parseCount("abc")).toThrow(/Invalid count/);
  });

  it("parses a min:max range", () => {
    expect(parseCount("1:5")).toEqual([1, 5]);
  });

  it("parses a min:* range", () => {
    expect(parseCount("1:*")).toEqual([1, "*"]);
  });

  it("throws on an invalid range", () => {
    expect(() => parseCount("a:5")).toThrow(/Invalid count range/);
    expect(() => parseCount("1:b")).toThrow(/Invalid count range/);
  });
});

describe("parseStrategy", () => {
  it("passes through valid strategies", () => {
    expect(parseStrategy("mandatory")).toBe("mandatory");
    expect(parseStrategy("personal")).toBe("personal");
    expect(parseStrategy("shared")).toBe("shared");
  });

  it("normalizes 'on-demand' to 'on demand'", () => {
    expect(parseStrategy("on-demand")).toBe("on demand");
  });

  it("throws on an unknown strategy", () => {
    expect(() => parseStrategy("bogus")).toThrow(/Invalid strategy/);
  });
});
