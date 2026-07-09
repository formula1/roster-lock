import { describe, it, expect } from "vitest";
import { z } from "zod";
import { describeSchemaShape } from "../../src/lib/schema-help";

describe("describeSchemaShape", () => {
  it("renders primitives and objects", () => {
    const schema = z.object({ name: z.string(), age: z.number(), active: z.boolean() }).strict();
    expect(describeSchemaShape(schema)).toBe("{ name: string, age: number, active: boolean }");
  });

  it("marks optional fields with a trailing ?", () => {
    const schema = z.object({ name: z.string(), nickname: z.string().optional() }).strict();
    expect(describeSchemaShape(schema)).toBe("{ name: string, nickname?: string }");
  });

  it("renders arrays, tuples, unions, enums, and literals", () => {
    const schema = z.object({
      tags: z.array(z.string()),
      pair: z.tuple([z.number(), z.string()]),
      mode: z.union([z.string(), z.number()]),
      kind: z.enum(["a", "b"]),
      star: z.literal("*"),
    }).strict();

    expect(describeSchemaShape(schema)).toBe(
      '{ tags: string[], pair: [number, string], mode: string | number, kind: "a" | "b", star: "*" }'
    );
  });

  it("renders records", () => {
    const schema = z.record(z.string(), z.number());
    expect(describeSchemaShape(schema)).toBe("Record<string, number>");
  });

  it("renders a placeholder for recursive (lazy) schemas instead of infinitely recursing", () => {
    type Node = { children: Array<Node> };
    const nodeSchema: z.ZodType<Node> = z.lazy(() => z.object({ children: z.array(nodeSchema) }).strict());
    const schema = z.object({ root: nodeSchema }).strict();

    expect(describeSchemaShape(schema)).toBe("{ root: <recursive> }");
  });
});
