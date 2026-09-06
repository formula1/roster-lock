import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSONSchemaType } from "ajv";
import { GameLauncherPlugin, GameProcessHandle, PiecePreview, PlayerId } from "@roster-lock/types";

// Test-only: lets an automated test (or a human, via match-agent-client)
// simulate a match ending without a real engine binary, real process, or
// real network connection - the whole point is to exercise the framework's
// own startGame -> GameProcessHandle -> gameEnded -> handleGameComplete
// pipeline (and, via getPreview/useDefaultPreview below, the preview
// pipeline) in isolation from any one engine's real launch/detection or
// image-decoding logic. See plugins/game-launcher/ikemen-go for what a real
// plugin looks like.
export type HeadlessGameConfig = {
  // PlayerIds to report as winners once the "match" ends. Empty means no
  // result - gameEnded is never called, mirroring a real engine that
  // couldn't determine an outcome (e.g. ikemen-go's WinSide === -1).
  winners: Array<PlayerId>,
  // How long to wait before "ending" the match - lets a test observe the
  // in-flight state (GameProcessHandle.exited === false) before it resolves.
  resultDelayMs: number,
};

const gameConfigSchema: JSONSchemaType<HeadlessGameConfig> = {
  type: "object",
  title: "Headless Match Settings",
  description: "Reports exactly these winners once the configured delay elapses. No real process is involved.",
  properties: {
    winners: {
      type: "array", items: { type: "string" }, default: [],
      title: "Winners", description: "PlayerIds to report as winners. Empty means no result.",
    },
    resultDelayMs: {
      type: "integer", minimum: 0, default: 0,
      title: "Result Delay (ms)", description: "How long to wait before the match \"ends\".",
    },
  },
  required: ["winners", "resultDelayMs"],
};

// getPreview/useDefaultPreview fixtures - deliberately don't decode any real
// image format (that's ikemen-go's own preview.ts's job, covered by its own
// tests). A real plugin's getPreview reads whatever asset format it owns off
// disk; this one reads back exactly the PiecePreview a test wrote into the
// piece folder, so match-agent tests can assert on an exact, test-chosen
// PiecePreview value instead of asserting on a hardcoded image mime type.
export const PREVIEW_FILE_NAME = "preview.json";

// Test helper: pairs with seedCompletePiece's `files` map (see
// tests/integration/helpers/piece.ts) to plant a preview getPreview will read.
export function previewFile(preview: PiecePreview): Record<string, string> {
  return { [PREVIEW_FILE_NAME]: JSON.stringify(preview) };
}

// No folder to read from (see GameLauncherPlugin["useDefaultPreview"]'s
// docs), so this is a fixed, deterministic placeholder derived from
// pieceType alone - lets a test assert on the exact value without needing to
// import a shared constant.
export function defaultPreviewFor(pieceType: string): PiecePreview {
  return {
    kind: "image",
    dataUri: `data:application/x-headless-fixture;base64,${Buffer.from(`default:${pieceType}`).toString("base64")}`,
  };
}

const Headless: GameLauncherPlugin<HeadlessGameConfig> = {
  name: "headless",
  publicInfo: {
    title: "Headless (Test Fixture)",
    description: "Reports a configured result immediately (or after a delay), with no real process. Test-only.",
  },
  // Not meaningful for a fixture that never actually connects to anything -
  // claims every mode so it never blocks a caller from exercising one.
  supportedConnectionModes: ["direct-tcp", "room", "internal"],
  supportedPlatforms: [
    { platform: "win32", arch: "x64" },
    { platform: "linux", arch: "x64" },
    { platform: "darwin", arch: "x64" },
    { platform: "darwin", arch: "arm64" },
  ],
  // No real piece definitions to match a roster against - this plugin never
  // reads rosterConfig.rosters at all.
  engineSha: "headless-no-piece-definitions",
  gameConfigSchema,
  localConfigSchema: {},

  async getLocalVersion(){
    return { title: "headless", id: "headless" };
  },
  async getSupportedVersion(){
    return { title: "headless", id: "headless" };
  },
  async validateBinaryLocation(){
    return { valid: true };
  },

  async getPreview(_pieceType, _pathVariables, pieceFolder){
    const previewPath = join(pieceFolder, PREVIEW_FILE_NAME);
    if(!existsSync(previewPath)) return undefined;
    return JSON.parse(await readFile(previewPath, "utf-8")) as PiecePreview;
  },
  async useDefaultPreview(pieceType){
    return defaultPreviewFor(pieceType);
  },

  async startGame(_binaryLocation, _target, _connectionConfig, args){
    const gameConfig = (args.gameConfig ?? {}) as Partial<HeadlessGameConfig>;
    const winners = gameConfig.winners ?? [];
    const resultDelayMs = gameConfig.resultDelayMs ?? 0;

    const exitCallbacks: Array<(code: number | null) => void> = [];
    let settled = false;

    const handle: GameProcessHandle = {
      exited: false,
      onExit(cb){ exitCallbacks.push(cb); },
      // Never crashes - there's no real process to crash.
      onCrash(){},
      async stop(){
        // -1 mirrors processHandle.ts's own convention for a non-natural
        // exit - stopping early reports no result, same as a real engine
        // killed mid-match.
        clearTimeout(timer);
        settleExit(-1);
      },
    };

    function settleExit(code: number){
      if(settled) return;
      settled = true;
      handle.exited = { code };
      for(const cb of exitCallbacks) cb(code);
    }

    const timer = setTimeout(()=>{
      settleExit(0);
      if(winners.length > 0) args.gameEnded({ winners });
    }, resultDelayMs);
    // Same reasoning as a real spawned child's unref() (see ikemen-go's
    // startGame) - this timer alone shouldn't keep the caller's process alive.
    timer.unref();

    return handle;
  },
};

export default Headless;
