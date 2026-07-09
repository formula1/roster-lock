import { Command } from "commander";

export function withDraftOption(cmd: Command): Command {
  return cmd.option(
    "-d, --draft <path>",
    "path to the draft file (defaults to the sole *.rosterlock.draft.json file in the current directory)"
  );
}
