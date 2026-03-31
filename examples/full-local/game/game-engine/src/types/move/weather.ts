
import { WeatherType } from "../stage";
import { EnumValue, enumValueSchema } from "./utils";

export type WeatherEffect = {
  type: "weather",
  value: EnumValue<WeatherType>,
  turns: number,
}

import { z, ZodType } from "zod";
export const weatherEffectSchema: ZodType<WeatherEffect> = z.object({
  type: z.literal("weather"),
  value: enumValueSchema(z.enum(WeatherType)),
  turns: z.number(),
}).strict();
