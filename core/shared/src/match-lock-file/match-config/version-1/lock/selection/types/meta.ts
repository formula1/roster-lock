import { PieceId } from "@roster-lock/types";

export type JSONShallowObject = Record<string, (
  | string | number | boolean
  | Array<string> | Array<number> | Array<boolean>
)>;

type SimpleSchemaType = (
  | "boolean" | "number" | "string"
  | "boolean[]" | "number[]" | "string[]"
)

export type SelectionPieceMeta<Config extends JSONShallowObject> = {
  schema: Record<string, SimpleSchemaType>,
  defaultMeta: Config,
  pieceMeta: Record<PieceId, Partial<Config>>,
}
