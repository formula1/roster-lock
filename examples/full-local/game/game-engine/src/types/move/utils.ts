import { z, ZodType } from "zod";

type MoveTargetCount = number | "*" | [number, number | "*"];

export type TargetFilter = (
  | { type: "all-except", except: MoveTargetCount }
  | { type: "explicit", targets: MoveTargetCount }
)
const moveTargetCountSchema: ZodType<MoveTargetCount> = (
  z.number()
  .or(z.literal("*"))
  .or(z.tuple([
    z.number(),
    z.number().or(z.literal("*"))]
  ))
);
export const targetFilterSchema: ZodType<TargetFilter> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("all-except"),
    except: moveTargetCountSchema,
  }).strict(),
  z.object({
    type: z.literal("explicit"),
    targets: moveTargetCountSchema,
  }).strict(),
]);

export const targetConfigSchema: ZodType<{ targets: Array<string> }> = z.object({
  targets: z.array(z.string()),
});


export type EnumValue<T extends string> = (
  | { type: "fixed", value: T }
  | { type: "random", values: Array<{ value: T, weight: number }> }
  | { type: "choose", values: Array<T> }
)
export const enumValueSchema = <T extends string>(enumSchema: ZodType<T>)=>(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("fixed"),
      value: enumSchema,
    }).strict(),
    z.object({
      type: z.literal("random"),
      values: z.array(z.object({ value: enumSchema, weight: z.number() }).strict()),
    }).strict(),
    z.object({
      type: z.literal("choose"),
      values: z.array(enumSchema),
    }).strict(),
  ])
);

export const enumValueConfigSchema: ZodType<{ chosenValue: string }> = z.object({
  chosenValue: z.string(),
});
