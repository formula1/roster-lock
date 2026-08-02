#!/usr/bin/env node
import { program, Command } from "commander";

import { initCommand, fromLockCommand, promoteCommand, publishCommand, draftValidateCommand } from "./commands/draft";
import {
  setInfoCommand,
  addPieceTypeCommand,
  editDefinitionCommand,
  addAssetCommand,
  removePieceTypeCommand,
  removeAssetCommand,
  engineShowCommand,
} from "./commands/engine";
import {
  addPieceCommand,
  editPieceCommand,
  importPieceCommand,
  rescanCommand,
  testDownloadCommand,
  rosterListCommand,
  removePieceCommand,
} from "./commands/roster";
import {
  addMediaOverrideCommand,
  editMediaOverrideCommand,
  removeMediaOverrideCommand,
  rescanMediaOverrideCommand,
} from "./commands/media-override";
import {
  addScriptCommand,
  selectionSetCommand,
  runScriptCommand,
  selectionShowCommand,
} from "./commands/selection";
import {
  pieceMetaSetCommand,
  pieceMetaShowCommand,
} from "./commands/piece-meta";
import { validateCommand } from "./commands/validate";
import { showCommand } from "./commands/show";
import { VERSION } from "./version";

program
  .name("rosterlock-config-editor")
  .description("A cli tool to build roster lock configs")
  .version(VERSION);

const draftCommand = new Command("draft").description("Manage the draft lifecycle (create, promote, publish, validate)");
draftCommand.addCommand(initCommand);
draftCommand.addCommand(fromLockCommand);
draftCommand.addCommand(promoteCommand);
draftCommand.addCommand(publishCommand);
draftCommand.addCommand(draftValidateCommand);
program.addCommand(draftCommand);

program.addCommand(validateCommand);
program.addCommand(showCommand);

const engineCommand = new Command("engine").description("Edit the staged lock's engine (piece types)");
engineCommand.addCommand(setInfoCommand);
engineCommand.addCommand(addPieceTypeCommand);
engineCommand.addCommand(editDefinitionCommand);
engineCommand.addCommand(addAssetCommand);
engineCommand.addCommand(removePieceTypeCommand);
engineCommand.addCommand(removeAssetCommand);
engineCommand.addCommand(engineShowCommand);
program.addCommand(engineCommand);

const rosterCommand = new Command("roster").description("Edit the staged lock's rosters (pieces)");
rosterCommand.addCommand(addPieceCommand);
rosterCommand.addCommand(editPieceCommand);
rosterCommand.addCommand(importPieceCommand);
rosterCommand.addCommand(rescanCommand);
rosterCommand.addCommand(testDownloadCommand);
rosterCommand.addCommand(rosterListCommand);
rosterCommand.addCommand(removePieceCommand);
program.addCommand(rosterCommand);

const mediaOverrideCommand = new Command("media-override").description("Edit the staged lock's partial media overrides (skins)");
mediaOverrideCommand.addCommand(addMediaOverrideCommand);
mediaOverrideCommand.addCommand(editMediaOverrideCommand);
mediaOverrideCommand.addCommand(removeMediaOverrideCommand);
mediaOverrideCommand.addCommand(rescanMediaOverrideCommand);
program.addCommand(mediaOverrideCommand);

const selectionCommand = new Command("selection").description("Edit the staged lock's selection config");
selectionCommand.addCommand(addScriptCommand);
selectionCommand.addCommand(selectionSetCommand);
selectionCommand.addCommand(runScriptCommand);
selectionCommand.addCommand(selectionShowCommand);
program.addCommand(selectionCommand);

const pieceMetaCommand = new Command("piece-meta").description("Edit the staged lock's piece meta (custom per-piece fields)");
pieceMetaCommand.addCommand(pieceMetaSetCommand);
pieceMetaCommand.addCommand(pieceMetaShowCommand);
program.addCommand(pieceMetaCommand);

program.parse();
