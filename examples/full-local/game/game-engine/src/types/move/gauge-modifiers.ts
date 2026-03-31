
import { GaugeType } from "../character";
import { TargetFilter, targetFilterSchema } from "./utils";
export type GaugeModifierSubtract = (
  { type: "gauge-subtract", stat: GaugeType, value: number, target: TargetFilter }
)
export type GaugeModifierAdd = (
  { type: "gauge-add", stat: GaugeType, value: number, target: TargetFilter }
)

import { z, ZodType } from "zod";
export const gaugeModifierSubtractSchema: ZodType<GaugeModifierSubtract> = z.object({
  type: z.literal("gauge-subtract"),
  stat: z.enum(GaugeType),
  value: z.number(),
  target: targetFilterSchema,
}).strict();
export const gaugeModifierAddSchema: ZodType<GaugeModifierAdd> = z.object({
  type: z.literal("gauge-add"),
  stat: z.enum(GaugeType),
  value: z.number(),
  target: targetFilterSchema,
}).strict();
