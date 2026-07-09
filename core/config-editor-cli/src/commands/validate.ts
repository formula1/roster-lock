import { Command } from "commander";
import { readFileSync } from "node:fs";
import { ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA, ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath } from "../lib/draft-io";
import { withDraftOption } from "../lib/cli-options";
import { formatError } from "../lib/errors";

export const validateCommand = withDraftOption(new Command("validate"))
  .description("Validate a draft (default) or, with --lock, a published lock file")
  .option("--lock <path>", "validate a plain lock file instead of a draft")
  .action(async (opts: { draft?: string, lock?: string }) => {
    try {
      if(opts.lock){
        const json = JSON.parse(readFileSync(opts.lock, "utf-8"));
        ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(json, true);
      } else {
        const draftPath = resolveDraftPath(opts.draft);
        const json = JSON.parse(readFileSync(draftPath, "utf-8"));
        ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast(json, true);
      }
      console.log("OK");
    } catch(e){
      console.error(formatError(e));
      process.exitCode = 1;
    }
  });
