import { Command } from "commander";
import { readFileSync } from "node:fs";
import { runUntrustedScript, DEFAULT_PLUGIN_DIR } from "@roster-lock/plugin-runtime";
import { ScriptPurposeInput } from "@roster-lock/types";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const runScriptCommand = withDraftOption(new Command("run-script"))
  .description("Run a selection script from the staged lock against sample input, without modifying the draft")
  .argument("<scriptRef>", "the script's key in scriptDictionary")
  .requiredOption("--input <jsonFile>", "JSON file with { purpose: ScriptPurposeInput, randomSeeds?: string[] }")
  .option("--method <name>", "exported function to call (default: main)")
  .action(withErrorHandling(async (scriptRef: string, opts: { draft?: string, input: string, method?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const input = JSON.parse(readFileSync(opts.input, "utf-8")) as {
      purpose: ScriptPurposeInput, randomSeeds?: Array<string>
    };

    const result = await runUntrustedScript(DEFAULT_PLUGIN_DIR, {
      config: draft.stagedLock,
      randomSeeds: input.randomSeeds ?? [],
      purpose: input.purpose,
      entryScript: { src: scriptRef, method: opts.method },
    });

    console.log(JSON.stringify(result, null, 2));
  }));
