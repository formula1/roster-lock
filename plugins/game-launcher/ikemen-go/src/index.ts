import { GameLauncherPlugin } from "@roster-lock/types";
import { readLocalVersion, fetchSupportedVersion } from "./version";
import { IKEMEN_ENGINE_SHA } from "./engineConfig";
import { startGame, IkemenGameConfig } from "./startGame";
import { validateBinaryLocation } from "./validateBinaryLocation";
import { gameConfigSchema } from "./gameConfigSchema";
import { validateGameConfig } from "./selectionValidation";

const IkemenGo: GameLauncherPlugin<IkemenGameConfig> = {
  name: "ikemen-go",
  publicInfo: {
    title: "Ikemen GO",
    description: "Launches Ikemen GO straight into a match via its Quick-VS command line, skipping its own menus and select screen.",
  },
  // "room"/"internal" aren't handled by startGame yet - only claim modes
  // that actually work today. See this package's readme.
  supportedConnectionModes: ["direct-tcp"],
  // Ikemen GO publishes 64-bit builds for Windows, Linux and macOS (both
  // Intel and Apple Silicon) - see docs/v2/binary-location.md. No 32-bit
  // entries: the Go toolchain build it ships from doesn't produce them.
  supportedPlatforms: [
    { platform: "win32", arch: "x64" },
    { platform: "linux", arch: "x64" },
    { platform: "darwin", arch: "x64" },
    { platform: "darwin", arch: "arm64" },
  ],
  engineSha: IKEMEN_ENGINE_SHA,
  gameConfigSchema,
  // Nothing beyond binaryLocation is configurable yet - a preferred port only
  // matters once "room" mode has a real bridge (direct-tcp's port is chosen
  // at room-creation time and arrives via connectionConfig, not here).
  localConfigSchema: {},

  // Ikemen has no CLI flag for either of these - both are answered without
  // starting the engine, by reading the executable and by asking GitHub what
  // the current release is. See this package's readme.
  getLocalVersion: readLocalVersion,
  getSupportedVersion: fetchSupportedVersion,
  // No updateBinary - left undefined deliberately (optional per GameLauncherPlugin).
  // A user updates by downloading a new Ikemen release and re-pointing
  // binaryLocation at it themselves.
  validateBinaryLocation: validateBinaryLocation,

  startGame: startGame,
  validateGameConfig,
};

export default IkemenGo;
