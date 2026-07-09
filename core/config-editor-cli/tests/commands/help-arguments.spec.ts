import { describe, it, expect } from "vitest";
import type { Command } from "commander";
import * as draftCommands from "../../src/commands/draft";
import * as engineCommands from "../../src/commands/engine";
import * as rosterCommands from "../../src/commands/roster";
import * as selectionCommands from "../../src/commands/selection";
import { validateCommand } from "../../src/commands/validate";
import { showCommand } from "../../src/commands/show";

// Commander only prints an "Arguments:" section in --help for arguments that have
// a description, so an argument without one is invisible to a user running --help,
// even though it's a required positional. This guards against adding a new one
// without documenting what it expects.
const allCommands: Array<Command> = [
  ...Object.values(draftCommands),
  ...Object.values(engineCommands),
  ...Object.values(rosterCommands),
  ...Object.values(selectionCommands),
  validateCommand,
  showCommand,
];

describe("command --help documents every positional argument", () => {
  for(const command of allCommands){
    for(const arg of command.registeredArguments){
      it(`"${command.name()}" argument "${arg.name()}" has a description`, () => {
        expect(arg.description.length).toBeGreaterThan(0);
      });
    }
  }
});
