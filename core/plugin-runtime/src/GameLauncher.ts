import { mkdir, writeFile, unlink, readFile, readdir, rm } from "node:fs/promises";
import type { Dirent } from "node:fs";
import {
  join as pathJoin, dirname as pathDirname, isAbsolute as pathIsAbsolute, relative as pathRelative,
} from "node:path";
import { randomUUID } from "node:crypto";
import {
  AnyGameLauncherPlugin, ConnectionConfig, ConnectionSetup, StartGameArgs, GameProcessHandle, PlatformTarget,
  RosterLockV1Config, PiecePreview,
} from "@roster-lock/types";
import { registerAsHost, awaitHostAddress, getLocalNetworkAddresses } from "@roster-lock/direct-ip-coordinator";
import { getPluginModuleByName, getPluginFullOfType } from "./plugin-management";
import type { PluginManager } from "./PluginHandler";

// What an admin's local match-agent reports back after installing a game-launcher
// plugin, so it can be submitted to a Room Match Maker's games registry without
// the registry ever having to install/execute the plugin itself.
export type AvailableGameLauncher = {
  pluginName: string,
  version: string,
  publicInfo: AnyGameLauncherPlugin["publicInfo"],
  supportedConnectionModes: AnyGameLauncherPlugin["supportedConnectionModes"],
  supportedRoomVersions: AnyGameLauncherPlugin["supportedRoomVersions"],
  supportedPlatforms: AnyGameLauncherPlugin["supportedPlatforms"],
  engineSha: AnyGameLauncherPlugin["engineSha"],
  // Room-shared - this is the half that gets submitted to a Room Match Maker's
  // games registry.
  gameConfigSchema: AnyGameLauncherPlugin["gameConfigSchema"],
  // Per-machine - this half never leaves the machine. It's here so a local
  // settings UI can render a form for it (e.g. "where's your Ikemen binary?"),
  // not for submission to any registry.
  localConfigSchema: AnyGameLauncherPlugin["localConfigSchema"],
};

// What a caller (e.g. match-agent) supplies to actually start a game -
// distinct from StartGameArgs (what the plugin itself receives). The caller
// has the real private key; startGame below is what turns it into the
// restrictive-permission temp file plugins get instead, so a plugin is safe
// by default without having to be trusted to handle the raw key itself.
export type StartGameRequest = Omit<StartGameArgs<unknown>, "currentMachine"> & {
  currentMachine: {
    machineId: string,
    publicKey: string,
    privateKey: string,
  },
};

// Per-machine settings for one installed game-launcher plugin - binaryLocation
// plus whatever that plugin's own localConfigSchema describes. Lives under
// the plugin directory (see GameLauncher.configFilePath), not in match-agent's
// own config file - it's plugin-runtime's own subtree to own, parallel to
// data/<package> (dataDirFor-style state) and node_modules/<package> (the
// installed code itself).
//
// binaryLocation may be absolute or relative - see GameLauncher.resolveBinaryLocation
// for what a relative value resolves against and why (docs/v2/binary-location.md).
export type GameLauncherLocalSettings = {
  binaryLocation?: string,
  localConfig?: unknown,
};

// Mirrors GameLauncherPlugin's version functions rather than restating their
// shape, so the interface can't drift from what plugins actually return.
export type GameLauncherVersion = Awaited<ReturnType<AnyGameLauncherPlugin["getLocalVersion"]>>;

// One subfolder of a plugin's getBinary dataDir (see GameLauncher.getBinary)
// - "a downloaded binary" is assumed to be exactly that: an immediate
// subdirectory of dataDir, since that's the only shape getBinary's own
// return value (one folder per call) and this listing (which only knows
// about folders, not whatever a plugin chooses to put inside one) can
// agree on without knowing a plugin's own internal layout.
export type DownloadedBinary = {
  binaryLocation: string,
  // Read fresh via the plugin's own getLocalVersion, not anything
  // roster-lock tracks itself - this is always the truth about what's
  // actually in the folder right now, never stale bookkeeping. null if
  // getLocalVersion rejects it (not a real/readable install - a half
  // -finished download, a folder someone put something else into).
  version: GameLauncherVersion | null,
  // Whether this is the plugin's current active binaryLocation - a UI
  // listing these can warn before removing the one actually in use,
  // without having to separately call getLocalSettings itself.
  active: boolean,
};

export interface IGameLauncher {
  listAvailable(): Promise<Array<AvailableGameLauncher>>,
  getLocalSettings(pluginName: string): Promise<GameLauncherLocalSettings>,
  setLocalSettings(pluginName: string, settings: GameLauncherLocalSettings): Promise<void>,
  getLocalVersion(pluginName: string, binaryLocation: string, target: PlatformTarget): Promise<GameLauncherVersion>,
  getSupportedVersion(pluginName: string, binaryLocation: string): Promise<GameLauncherVersion>,
  // Throws if the named plugin doesn't declare a getBinary - callers
  // should check listAvailable/the plugin module rather than rely on
  // catching. Persists whatever binaryLocation the plugin returns as this
  // plugin's new active local setting (so a caller doesn't need a separate
  // setLocalSettings call) and returns it too, so a caller can reflect it
  // immediately without a round-trip back through getLocalSettings.
  getBinary(pluginName: string, target: PlatformTarget): Promise<{ binaryLocation: string }>,
  // Every binary getBinary has ever downloaded for this plugin that
  // hasn't since been removed - so a UI can show what's accumulating and
  // let a player clear out old versions instead of them silently piling
  // up forever under dataDir. Purely a filesystem + getLocalVersion read
  // (see DownloadedBinary) - no bookkeeping of its own; a caller that also
  // wants "downloaded at"/"last used" (not something any plugin could
  // report) tracks that itself and merges it in. Empty array for a plugin
  // that's never downloaded anything (or doesn't support getBinary at
  // all) - not an error, same "nothing to report" shape as
  // validateGameConfig below.
  listBinaries(pluginName: string, target: PlatformTarget): Promise<Array<DownloadedBinary>>,
  // Throws if binaryLocation doesn't resolve inside this plugin's own
  // getBinary dataDir - never deletes anything else on the host, the same
  // containment guarantee match-agent's own file-system browser makes
  // (see util-routers/file-system/resolve-within-root.ts). Clears the
  // plugin's active binaryLocation setting if the one just removed was it,
  // rather than leaving a dangling reference to a folder that no longer
  // exists.
  removeBinary(pluginName: string, binaryLocation: string): Promise<void>,
  // Turns a stored binaryLocation (absolute, or relative to pluginDir - see
  // docs/v2/binary-location.md) into the real absolute path a plugin itself
  // would receive - the same resolution startGame/getLocalVersion/etc.
  // already do internally before ever calling a plugin, exposed so a
  // caller that needs to key something off the *real* path (e.g.
  // match-agent recording binary-usage bookkeeping against the same
  // absolute paths listBinaries reports) doesn't have to reimplement the
  // relative-to-pluginDir convention itself.
  resolveBinaryLocation(binaryLocation: string): string,
  validateBinaryLocation(
    pluginName: string, binaryLocation: string, target: PlatformTarget
  ): Promise<{ valid: true } | { valid: false, message: string }>,
  // Empty array when the plugin has no validateGameConfig hook at all - same "nothing to report"
  // result as a plugin that implements the hook and finds no problems, so a caller doesn't need to
  // special-case "unsupported" vs "valid".
  validateGameConfig(pluginName: string, gameConfig: unknown, rosterConfig: RosterLockV1Config): Promise<Array<string>>,
  // undefined either way means "no preview available" - a plugin without the
  // relevant hook at all, or one that has it but couldn't produce anything
  // for this particular piece/pieceType.
  getPreview(
    pluginName: string, pieceType: string, pathVariables: Record<string, string>, pieceFolder: string
  ): Promise<PiecePreview | undefined>,
  useDefaultPreview(pluginName: string, pieceType: string): Promise<PiecePreview | undefined>,
  startGame(
    pluginName: string, binaryLocation: string, target: PlatformTarget,
    connectionSetup: ConnectionSetup, request: StartGameRequest
  ): Promise<GameProcessHandle>,
}

export class GameLauncher implements IGameLauncher {
  constructor(private pluginManager: PluginManager){}

  async listAvailable(): Promise<Array<AvailableGameLauncher>> {
    const plugins = await getPluginFullOfType(this.pluginManager.pluginDir, "game-launcher");
    return plugins.map(({ entry, module })=>({
      pluginName: entry.package,
      version: entry.version,
      publicInfo: module.publicInfo,
      supportedConnectionModes: module.supportedConnectionModes,
      supportedRoomVersions: module.supportedRoomVersions,
      supportedPlatforms: module.supportedPlatforms,
      engineSha: module.engineSha,
      gameConfigSchema: module.gameConfigSchema,
      localConfigSchema: module.localConfigSchema,
    }));
  }

  async getLocalSettings(pluginName: string): Promise<GameLauncherLocalSettings> {
    try {
      const contents = await readFile(this.configFilePath(pluginName), "utf-8");
      return JSON.parse(contents) as GameLauncherLocalSettings;
    } catch(e){
      if((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }

  async setLocalSettings(pluginName: string, settings: GameLauncherLocalSettings): Promise<void> {
    const filePath = this.configFilePath(pluginName);
    await mkdir(pathDirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(settings, null, 2) + "\n");
  }

  async getLocalVersion(pluginName: string, binaryLocation: string, target: PlatformTarget){
    const plugin = await this.moduleFor(pluginName);
    return plugin.getLocalVersion(this.resolveBinaryLocation(binaryLocation), target);
  }

  async getSupportedVersion(pluginName: string, binaryLocation: string){
    const plugin = await this.moduleFor(pluginName);
    return plugin.getSupportedVersion(this.resolveBinaryLocation(binaryLocation));
  }

  async getBinary(pluginName: string, target: PlatformTarget): Promise<{ binaryLocation: string }> {
    const plugin = await this.moduleFor(pluginName);
    if(!plugin.getBinary){
      throw new Error(`Game Launcher "${pluginName}" doesn't support in-app updates`);
    }

    const dataDir = this.binariesDataDir(pluginName);
    await mkdir(dataDir, { recursive: true });
    const { binaryLocation } = await plugin.getBinary(dataDir, target);

    const existing = await this.getLocalSettings(pluginName);
    const storedLocation = this.relativizeBinaryLocation(binaryLocation);
    await this.setLocalSettings(pluginName, { ...existing, binaryLocation: storedLocation });
    return { binaryLocation };
  }

  async listBinaries(pluginName: string, target: PlatformTarget): Promise<Array<DownloadedBinary>> {
    const dataDir = this.binariesDataDir(pluginName);
    let entries: Array<Dirent>;
    try {
      entries = await readdir(dataDir, { withFileTypes: true });
    } catch(e){
      if((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }

    const plugin = await this.moduleFor(pluginName);
    const settings = await this.getLocalSettings(pluginName);
    const activeResolved = settings.binaryLocation ? this.resolveBinaryLocation(settings.binaryLocation) : null;

    const results: Array<DownloadedBinary> = [];
    for(const entry of entries){
      if(!entry.isDirectory()) continue;
      const binaryLocation = pathJoin(dataDir, entry.name);
      // Not every folder under dataDir is necessarily a readable install
      // right now (a download that failed partway through, say) -
      // getLocalVersion rejecting it is reported as null, not a reason to
      // drop the folder from the list (it still takes up space, and still
      // needs to be removable).
      const version = await plugin.getLocalVersion(binaryLocation, target).catch(() => null);
      results.push({ binaryLocation, version, active: binaryLocation === activeResolved });
    }
    return results;
  }

  async removeBinary(pluginName: string, binaryLocation: string): Promise<void> {
    if(!this.isManagedBinary(pluginName, binaryLocation)){
      throw new Error(`"${binaryLocation}" is not a binary "${pluginName}" downloaded`);
    }

    await rm(binaryLocation, { recursive: true, force: true });

    const settings = await this.getLocalSettings(pluginName);
    if(settings.binaryLocation && this.resolveBinaryLocation(settings.binaryLocation) === binaryLocation){
      const { binaryLocation: _removed, ...rest } = settings;
      await this.setLocalSettings(pluginName, rest);
    }
  }

  async validateBinaryLocation(pluginName: string, binaryLocation: string, target: PlatformTarget){
    const plugin = await this.moduleFor(pluginName);
    return plugin.validateBinaryLocation(this.resolveBinaryLocation(binaryLocation), target);
  }

  async validateGameConfig(pluginName: string, gameConfig: unknown, rosterConfig: RosterLockV1Config){
    const plugin = await this.moduleFor(pluginName);
    if(!plugin.validateGameConfig) return [];
    return plugin.validateGameConfig(gameConfig, rosterConfig);
  }

  async getPreview(
    pluginName: string, pieceType: string, pathVariables: Record<string, string>, pieceFolder: string
  ): Promise<PiecePreview | undefined> {
    const plugin = await this.moduleFor(pluginName);
    if(!plugin.getPreview) return undefined;
    return plugin.getPreview(pieceType, pathVariables, pieceFolder);
  }

  async useDefaultPreview(pluginName: string, pieceType: string): Promise<PiecePreview | undefined> {
    const plugin = await this.moduleFor(pluginName);
    if(!plugin.useDefaultPreview) return undefined;
    return plugin.useDefaultPreview(pieceType);
  }

  async startGame(
    pluginName: string, binaryLocation: string, target: PlatformTarget,
    connectionSetup: ConnectionSetup, request: StartGameRequest
  ): Promise<GameProcessHandle> {
    const plugin = await this.moduleFor(pluginName);
    const connectionConfig = await this.resolveConnectionConfig(connectionSetup, request.relayRoomId);
    const { filePath, cleanup } = await this.writePrivateKeyFile(pluginName, request.currentMachine.privateKey);

    const args: StartGameArgs<unknown> = {
      ...request,
      currentMachine: {
        machineId: request.currentMachine.machineId,
        publicKey: request.currentMachine.publicKey,
        privateKeyFile: filePath,
      },
    };

    let handle: GameProcessHandle;
    try {
      handle = await plugin.startGame(this.resolveBinaryLocation(binaryLocation), target, connectionConfig, args);
    } catch(e){
      await cleanup();
      throw e;
    }

    // Best-effort either way (see GameProcessHandle's own docs on what onExit
    // actually guarantees) - if the plugin can't tell us the game ended,
    // the key file just outlives the (possibly already-gone) process it was
    // written for, same tradeoff as any other temp file cleanup relying on
    // a lifecycle hook that isn't always fireable.
    handle.onExit(()=>{ cleanup(); });
    handle.onCrash(()=>{ cleanup(); });

    return handle;
  }

  // A plugin only ever sees a resolved ConnectionConfig - direct-tcp's
  // rendezvous is a coordinator concern, not something every plugin should
  // have to reimplement (this is exactly what @roster-lock/direct-ip-coordinator
  // exists to centralize). "room"/"internal" already are what a plugin needs
  // as-is, nothing to resolve.
  private async resolveConnectionConfig(
    setup: ConnectionSetup, relayRoomId: string
  ): Promise<ConnectionConfig> {
    if(setup.type !== "direct-tcp") return setup;

    if(setup.party === "host"){
      // Best-effort, not awaited: registerAsHost only resolves once the
      // coordinator has served every expected client and closed the
      // connection, so awaiting it here would hold up this same startGame
      // call (and whatever HTTP request is behind it) until the whole
      // room's clients have connected, not just until the host itself is
      // ready to run.
      registerAsHost(setup.coordinator, {
        roomKey: relayRoomId, listenPort: setup.port, localAddresses: getLocalNetworkAddresses(),
      }).catch(()=>{});
      return { type: "direct-tcp", party: "host", port: setup.port };
    }

    const hostAddress = await awaitHostAddress(setup.coordinator, relayRoomId);
    return { type: "direct-tcp", party: "client", port: setup.port, hostIp: hostAddress.ip };
  }

  private moduleFor(pluginName: string){
    return getPluginModuleByName(this.pluginManager.pluginDir, pluginName, "game-launcher");
  }

  // A stored binaryLocation may be absolute (an ordinary single-machine
  // install anywhere on disk - resolved as-is, unchanged from before) or
  // relative, resolved against pluginDir - the same root this plugin's own
  // settings file, installed code, and data already live under (see
  // configFilePath/writePrivateKeyFile below). This is what lets a
  // USB-hosted setup keep working after the USB remounts at a different
  // path/drive letter: point --plugin-folder at the USB, store binaryLocation
  // relative to it, and both move together - see docs/v2/binary-location.md.
  // A plugin always receives an already-resolved absolute path; it never
  // sees which form was actually stored.
  resolveBinaryLocation(binaryLocation: string): string {
    if(pathIsAbsolute(binaryLocation)) return binaryLocation;
    return pathJoin(this.pluginManager.pluginDir, binaryLocation);
  }

  // The reverse of resolveBinaryLocation, for getBinary: a plugin always
  // returns an absolute path (it has no reason to know pluginDir exists),
  // but getBinary's own dataDir already sits under pluginDir, so storing it
  // relative keeps the same USB-portability resolveBinaryLocation exists
  // for in the first place - only a plugin that (unusually) put its binary
  // somewhere else entirely falls back to storing the absolute form as-is.
  private relativizeBinaryLocation(binaryLocation: string): string {
    const relative = pathRelative(this.pluginManager.pluginDir, binaryLocation);
    const staysInsidePluginDir = !relative.startsWith("..") && !pathIsAbsolute(relative);
    return staysInsidePluginDir ? relative : binaryLocation;
  }

  // packageName can contain "/" (scoped packages) - path.join treats that as
  // an ordinary nested directory, same as node_modules/<scope>/<name> and the
  // data/<package> convention already in use, so no filename escaping needed.
  private configFilePath(pluginName: string): string {
    return pathJoin(this.pluginManager.pluginDir, "config", pluginName, "local-config.json");
  }

  // The plugin's own folder to lay its downloaded binaries out in however
  // it likes (including side by side across versions) - parallel to
  // data/<package>/keys below, not something a user sees or configures.
  private binariesDataDir(pluginName: string): string {
    return pathJoin(this.pluginManager.pluginDir, "data", pluginName, "binaries");
  }

  // Whether binaryLocation is one getBinary actually produced for this
  // plugin (an immediate subdirectory of its dataDir), as opposed to one a
  // user pointed at by hand (Browse/typed) - listBinaries only ever
  // enumerates dataDir's own contents, so an externally-configured
  // binaryLocation could never show up there regardless, and removeBinary
  // must never be allowed to delete outside dataDir in the first place.
  private isManagedBinary(pluginName: string, binaryLocation: string): boolean {
    const relative = pathRelative(this.binariesDataDir(pluginName), binaryLocation);
    return relative !== "" && !relative.startsWith("..") && !pathIsAbsolute(relative);
  }

  private async writePrivateKeyFile(pluginName: string, privateKey: string){
    const dir = pathJoin(this.pluginManager.pluginDir, "data", pluginName, "keys");
    await mkdir(dir, { recursive: true });
    const filePath = pathJoin(dir, `${randomUUID()}.key`);
    await writeFile(filePath, privateKey, { mode: 0o600 });

    let cleaned = false;
    const cleanup = async () => {
      if(cleaned) return;
      cleaned = true;
      await unlink(filePath).catch(()=>{});
    };
    return { filePath, cleanup };
  }
}
