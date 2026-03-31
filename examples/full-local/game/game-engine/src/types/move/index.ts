
export * from "./utils";

import { GaugeModifierSubtract, GaugeModifierAdd } from "./gauge-modifiers";
import { WeatherEffect } from "./weather";

export type MoveEffect = (
  | GaugeModifierSubtract
  | GaugeModifierAdd
  | WeatherEffect
);

export type RunnableMove = Record<string, MoveEffect>;

import { z, ZodType } from "zod";

import { gaugeModifierSubtractSchema, gaugeModifierAddSchema } from "./gauge-modifiers";
import { weatherEffectSchema } from "./weather";
export const moveEffectSchema: ZodType<MoveEffect> = z.union([
  gaugeModifierSubtractSchema,
  gaugeModifierAddSchema,
  weatherEffectSchema,
]);
