
import { Count } from "@roster-lock/types";
import { z } from "zod";

export const CountSchema: z.ZodType<Count> = z.union([
  z.number().positive(),
  z.literal("*"),
  z.tuple([z.number().min(0), z.union([z.number().positive(), z.literal("*")])]),
]).refine((count) => {
  if(!Array.isArray(count)) return true;
  if(count[1] === "*") return true;
  return count[0] < count[1];
}, { message: "maximum should be greater than the minimum" });
