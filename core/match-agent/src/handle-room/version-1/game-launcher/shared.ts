import { PlatformTarget } from "@roster-lock/types";
import { HTTPError } from "../../../utils/http-router";
import { V1Env } from "../globals/types";

export function requirePluginName(routeInfo: { params: Record<string, string | undefined> }): string {
  const pluginName = routeInfo.params.pluginName;
  if(!pluginName) throw new HTTPError(400, "Missing pluginName");
  return pluginName;
}

export async function requireBinaryLocation(env: V1Env, pluginName: string): Promise<string> {
  const settings = await env.pluginRuntime.gameLauncher.getLocalSettings(pluginName);
  if(!settings.binaryLocation){
    throw new HTTPError(400, `Game launcher "${pluginName}" has no binaryLocation configured`);
  }
  return settings.binaryLocation;
}

// See docs/v2/binary-location.md - every GameLauncherPlugin function that
// resolves a concrete binary out of a (possibly multi-platform) binaryLocation
// bundle takes a required target, with no implicit "current host" default at
// that layer. match-agent is what decides the target value: it defaults to
// its own process.platform/process.arch (the ordinary case - a client asking
// match-agent to run/inspect the game it's about to run on this same host),
// but a caller can override either via query params for the deliberate
// exception (e.g. forcing a win32-x64 build under Wine on a Linux host).
export function resolveTarget(routeInfo: { url: URL }): PlatformTarget {
  const platform = routeInfo.url.searchParams.get("platform");
  const arch = routeInfo.url.searchParams.get("arch");
  return {
    platform: (platform || process.platform) as PlatformTarget["platform"],
    arch: (arch || process.arch) as PlatformTarget["arch"],
  };
}
