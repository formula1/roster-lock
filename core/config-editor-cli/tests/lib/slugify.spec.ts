import { describe, it, expect } from "vitest";
import { slugify } from "../../src/lib/slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces underscores with dashes", () => {
    expect(slugify("hello_world")).toBe("hello-world");
  });

  it("strips characters outside a-z0-9-", () => {
    expect(slugify("Hello, World! 2.0")).toBe("hello-world-20");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("collapses repeated dashes", () => {
    expect(slugify("a---b")).toBe("a-b");
  });

  it("returns an empty string for input with no valid characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
