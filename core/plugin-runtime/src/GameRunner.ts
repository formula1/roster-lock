import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { join as pathJoin, dirname as pathDirname, isAbsolute as pathIsAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import {
  GameRunnerPlugin, ConnectionConfig, ConnectionSetup, StartGameArgs, GameProcessHandle, PlatformTarget,
} from "@roster-lock/types";
import { registerAsHost, awaitHostAddress, getLocalNetworkAddresses } from "@roster-lock/direct-ip-coordinator";
import { getPluginModuleByName, getPluginFullOfType } from "./plugin-management";
import type { PluginManager } from "./PluginHandler";

// What an admin's local match-agent reports back after installing a game-runner
// plugin, so it can be submitted to a Room Match Maker's games registry without
// the registry ever having to install/execute the plugin itself.
export type AvailableGameRunner = {
  pluginName: string,
  version: string,
  publicInfo: GameRunnerPlugin["publicInfo"],
  supportedConnectionModes: GameRunnerPlugin["supportedConnectionModes"],
  supportedRoomVersions: GameRunnerPlugin["supportedRoomVersions"],
  supportedPlatforms: GameRunnerPlugin["supportedPlatforms"],
  engineSha: GameRunnerPlugin["engineSha"],
  // Room-shared - this is the half that gets submitted to a Room Match Maker's
  // games registry.
  gameConfigSchema: GameRunnerPlugin["gameConfigSchema"],
  // Per-machine - this half never leaves the machine. It's here so a local
  // settings UI can render a form for it (e.g. "where's your Ikemen binary?"),
  // not for submission to any registry.
  localConfigSchema: GameRunnerPlugin["localConfigSchema"],
};

// What a caller (e.g. match-agent) supplies to actually start a game -
// distinct from StartGameArgs (what the plugin itself receives). The caller
// has the real private key; startGame below is what turns it into the
// restrictive-permission temp file plugins get instead, so a plugin is safe
// by default without having to be trusted to handle the raw key itself.
export type StartGameRequest = Omit<StartGameArgs, "currentMachine"> & {
  currentMachine: {
    machineId: string,
    publicKey: string,
    privateKey: string,
  },
};

// Per-machine settings for one installed game-runner plugin - binaryLocation
// plus whatever that plugin's own localConfigSchema describes. Lives under
// the plugin directory (see GameRunner.configFilePath), not in match-agent's
// own config file - it's plugin-runtime's own subtree to own, parallel to
// data/<package> (dataDirFor-style state) and node_modules/<package> (the
// installed code itself).
//
// binaryLocation may be absolute or relative - see GameRunner.resolveBinaryLocation
// for what a relative value resolves against and why (docs/v2/binary-location.md).
export type GameRunnerLocalSettings = {
  binaryLocation?: string,
  localConfig?: unknown,
};

// Mirrors GameRunnerPlugin's version functions rather than restating their
// shape, so the interface can't drift from what plugins actually return.
export type GameRunnerVersion = Awaited<ReturnType<GameRunnerPlugin["getLocalVersion"]>>;

export interface IGameRunner {
  listAvailable(): Promise<Array<AvailableGameRunner>>,
  getLocalSettings(pluginName: string): Promise<GameRunnerLocalSettings>,
  setLocalSettings(pluginName: string, settings: GameRunnerLocalSettings): Promise<void>,
  getLocalVersion(pluginName: string, binaryLocation: string, target: PlatformTarget): Promise<GameRunnerVersion>,
  getSupportedVersion(pluginName: string, binaryLocation: string): Promise<GameRunnerVersion>,
  // Throws if the named plugin doesn't declare an updateBinary - callers
  // should check listAvailable/the plugin module rather than rely on catching.
  updateBinary(pluginName: string, binaryLocation: string, target: PlatformTarget): Promise<void>,
  validateBinaryLocation(
    pluginName: string, binaryLocation: string, target: PlatformTarget
  ): Promise<{ valid: true } | { valid: false, message: string }>,
  startGame(
    pluginName: string, binaryLocation: string, target: PlatformTarget,
    connectionSetup: ConnectionSetup, request: StartGameRequest
  ): Promise<GameProcessHandle>,
}

export class GameRunner implements IGameRunner {
  constructor(private pluginManager: PluginManager){}

  async listAvailable(): Promise<Array<AvailableGameRunner>> {
    const plugins = await getPluginFullOfType(this.pluginManager.pluginDir, "game-runner");
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

  async getLocalSettings(pluginName: string): Promise<GameRunnerLocalSettings> {
    try {
      const contents = await readFile(this.configFilePath(pluginName), "utf-8");
      return JSON.parse(contents) as GameRunnerLocalSettings;
    } catch(e){
      if((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }

  async setLocalSettings(pluginName: string, settings: GameRunnerLocalSettings): Promise<void> {
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

  async updateBinary(pluginName: string, binaryLocation: string, target: PlatformTarget){
    const plugin = await this.moduleFor(pluginName);
    if(!plugin.updateBinary){
      throw new Error(`Game Runner "${pluginName}" doesn't support in-app updates`);
    }
    return plugin.updateBinary(this.resolveBinaryLocation(binaryLocation), target);
  }

  async validateBinaryLocation(pluginName: string, binaryLocation: string, target: PlatformTarget){
    const plugin = await this.moduleFor(pluginName);
    return plugin.validateBinaryLocation(this.resolveBinaryLocation(binaryLocation), target);
  }

  async startGame(
    pluginName: string, binaryLocation: string, target: PlatformTarget,
    connectionSetup: ConnectionSetup, request: StartGameRequest
  ): Promise<GameProcessHandle> {
    const plugin = await this.moduleFor(pluginName);
    const connectionConfig = await this.resolveConnectionConfig(connectionSetup, request.relayRoomId);
    const { filePath, cleanup } = await this.writePrivateKeyFile(pluginName, request.currentMachine.privateKey);

    const args: StartGameArgs = {
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
    return getPluginModuleByName(this.pluginManager.pluginDir, pluginName, "game-runner");
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
  private resolveBinaryLocation(binaryLocation: string): string {
    if(pathIsAbsolute(binaryLocation)) return binaryLocation;
    return pathJoin(this.pluginManager.pluginDir, binaryLocation);
  }

  // packageName can contain "/" (scoped packages) - path.join treats that as
  // an ordinary nested directory, same as node_modules/<scope>/<name> and the
  // data/<package> convention already in use, so no filename escaping needed.
  private configFilePath(pluginName: string): string {
    return pathJoin(this.pluginManager.pluginDir, "config", pluginName, "local-config.json");
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
