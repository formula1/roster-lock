import { ZodType } from "zod";

type ZodNode = { type: string, def: Record<string, unknown> };

/**
 * Renders a compact, human-readable sketch of a zod schema's shape (e.g.
 * `{ name: string, count: number | "*" }`), for embedding in --help text so users
 * know what a --json input needs to look like without reading source.
 */
export function describeSchemaShape(schema: ZodType): string {
  return describe(schema as unknown as ZodNode);
}

function describe(node: ZodNode): string {
  switch(node.type){
    case "object": {
      const shape = node.def.shape as Record<string, ZodNode>;
      const parts = Object.entries(shape).map(([key, value]) => {
        const isOptional = value.type === "optional";
        const inner = isOptional ? (value.def.innerType as ZodNode) : value;
        return `${key}${isOptional ? "?" : ""}: ${describe(inner)}`;
      });
      return `{ ${parts.join(", ")} }`;
    }
    case "array":
      return `${describe(node.def.element as ZodNode)}[]`;
    case "tuple":
      return `[${(node.def.items as Array<ZodNode>).map(describe).join(", ")}]`;
    case "union":
      return (node.def.options as Array<ZodNode>).map(describe).join(" | ");
    case "enum":
      return Object.values(node.def.entries as Record<string, string>).map((v) => JSON.stringify(v)).join(" | ");
    case "literal":
      return (node.def.values as Array<unknown>).map((v) => JSON.stringify(v)).join(" | ");
    case "record":
      return `Record<${describe(node.def.keyType as ZodNode)}, ${describe(node.def.valueType as ZodNode)}>`;
    case "optional":
      return `${describe(node.def.innerType as ZodNode)}?`;
    case "lazy":
      return "<recursive>";
    default:
      return node.type;
  }
}
