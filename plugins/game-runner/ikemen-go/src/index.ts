import { GameRunnerPlugin } from "@roster-lock/types";
import { readLocalVersion, fetchSupportedVersion } from "./version";
import { IKEMEN_ENGINE_SHA } from "./engineConfig";
import { startGame } from "./startGame";

const IkemenGo: GameRunnerPlugin = {
  name: "ikemen-go",
  publicInfo: {
    title: "Ikemen GO",
    description: "Launches Ikemen GO straight into a match via its Quick-VS command line, skipping its own menus and select screen.",
  },
  // "room"/"internal" aren't handled by startGame yet - only claim modes
  // that actually work today. See this package's readme.
  supportedConnectionModes: ["direct-tcp"],
  engineSha: IKEMEN_ENGINE_SHA,
  gameConfigSchema: {
    type: "object",
    properties: {
      teamMode: {
        type: "string",
        enum: ["single", "simul", "tag", "turns"],
        description: "Applies to both sides. Defaults to \"single\" for a solo character pick, \"simul\" otherwise.",
      },
      roundTime: { type: "number", description: "Round time in ticks; -1 disables the timer." },
      rounds: { type: "number", description: "Number of rounds before Ikemen quits." },
    },
  },
  // Nothing beyond binaryLocation is configurable yet - a preferred port only
  // matters once "room" mode has a real bridge (direct-tcp's port is chosen
  // at room-creation time and arrives via connectionConfig, not here).
  localConfigSchema: {},

  // Ikemen has no CLI flag for either of these - both are answered without
  // starting the engine, by reading the executable and by asking GitHub what
  // the current release is. See this package's readme.
  getLocalVersion: readLocalVersion,
  getSupportedVersion: fetchSupportedVersion,
  // No updateBinary - left undefined deliberately (optional per GameRunnerPlugin).
  // A user updates by downloading a new Ikemen release and re-pointing
  // binaryLocation at it themselves.

  startGame: startGame,
};

export default IkemenGo;
