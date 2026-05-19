import { readFileSync } from "node:fs";
import path from "node:path";

export function importPackage(
  pluginDir: string, packageName: string
){
  return JSON.parse(
    readFileSync(
      path.join(pluginDir, "node_modules", packageName, "package.json"),
      "utf-8"
    )
  ) as Record<string, unknown>;
}

export async function importPlugin(
  pluginDir: string, packageName: string, installedPkgJson: ReturnType<typeof importPackage>
){
  const mainFile = (installedPkgJson.main as string | undefined) ?? "index.js";
  const mainPath = path.join(pluginDir, "node_modules", packageName, mainFile);

  return (await import(mainPath)) as Record<string, unknown>
}
