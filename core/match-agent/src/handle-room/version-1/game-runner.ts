import { HTTPRequestHandler } from "../../utils/http-router";
import { V1Env } from "./globals/types";

// One listing endpoint, mirroring /piece/sort-list/available - every installed
// game-runner plugin's full AvailableGameRunner record in one response, rather
// than splitting connection-mode support and gameConfigSchema into separate
// per-plugin routes. Both are small, static JSON already computed by
// listAvailable() from the plugin's own module fields, so there's no
// fetch-cost reason to make a client ask for them separately, and nothing
// else in this router splits a plugin's metadata that way either.
export const listAvailableGameRunners: HTTPRequestHandler = async function(
  this: V1Env, { res }
){
  const available = await this.pluginRuntime.gameRunner.listAvailable();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(available));
}
