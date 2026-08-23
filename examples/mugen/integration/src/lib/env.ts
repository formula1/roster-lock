import * as fs from "fs";
import * as path from "path";

export function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for(const rawLine of content.split("\n")){
    const line = rawLine.trim();
    if(!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if(eq === -1) continue;
    result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return result;
}

const ENV_FILES = ["internal-urls.env", "relay.env", "titled-room.env", "coordinator.env", "game-launchers.env"];

/** Loads and merges every env file the mugen example's services are configured from. */
export function loadEnvVars(envVarsDir: string): Record<string, string> {
  return Object.assign({}, ...ENV_FILES.map(file => parseEnvFile(path.join(envVarsDir, file))));
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not defined`);
  return value;
}
