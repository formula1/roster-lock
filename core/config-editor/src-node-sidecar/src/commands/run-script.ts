
import { runUntrustedScript } from "@roster-lock/node-services";
import { ScriptStarter } from "@roster-lock/shared";
import { z, ZodType} from "zod";

const PurposeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("piece-user-validation"),
    pieceType: z.string(),
    userId: z.string(),
    input: z.array(z.any()),
  }),
  z.object({
    type: z.literal("piece-merge"),
    pieceType: z.string(),
    users: z.array(z.string()),
    input: z.record(z.string(), z.array(z.any())),
  }),
  z.object({
    type: z.literal("global-validation"),
    pieceTypes: z.array(z.string()),
    users: z.array(z.string()),
    input: z.record(z.string(), z.any()),
  }),
]);

const ScriptConfigSchema: ZodType<ScriptStarter> = z.object({
  entryScriptPath: z.string(),
  randomSeeds: z.array(z.string()),
  purpose: PurposeSchema,
  config: z.any(),
  entryScript: z.object({
    type: z.string().optional(),
    src: z.string(),
    method: z.string().optional()
  })
});

export async function runUntrustedScriptCommand(json: unknown) {
  try {
    const config = ScriptConfigSchema.parse(json) as ScriptStarter;
    const result = await runUntrustedScript(config);
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message + "\n");
    process.exitCode = 1;
  }
}
