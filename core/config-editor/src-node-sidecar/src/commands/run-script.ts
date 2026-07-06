
import { runUntrustedScript, ScriptError } from "@roster-lock/plugin-runtime";
import { ScriptStarter } from "@roster-lock/types";
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

const ScriptConfigSchema: ZodType<Omit<ScriptStarter, "debugLog">> = z.object({
  randomSeeds: z.array(z.string()),
  purpose: PurposeSchema,
  config: z.any(),
  entryScript: z.object({
    src: z.string(),
    method: z.string().optional()
  })
});

export async function runUntrustedScriptCommand(
  pluginDir: string, json: unknown
) {
  try {
    const config = { ...ScriptConfigSchema.parse(json), debugLog: [] };
    try {
      const result = await runUntrustedScript(pluginDir, config);
      process.stdout.write(
        JSON.stringify({ debugLog: config.debugLog, status: "success", result }) + "\n"
      );
      process.exitCode = 0;
    } catch (error) {
      process.stdout.write(
        JSON.stringify({ debugLog: config.debugLog, status: "fail", result: error.message }) + "\n"
      );
      process.exitCode = 0;
    }
  }catch(error){
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message + "\n");
    process.exitCode = 1;
  }
}
