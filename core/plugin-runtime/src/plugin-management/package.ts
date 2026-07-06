import { PluginType, PLUGIN_TYPES } from "./plugin-types";
import z, { ZodType } from "zod";
import { readFile } from "node:fs/promises"
import { join as pathJoin } from "node:path";

export type PluginPackageType = {
  name: string;
  version: string;
  main?: string;
  types?: string
  "roster-lock": {
    pluginType: PluginType,
    priority?: number
  },
  // Allow any other standard package.json fields
  [key: string]: any; 
}

export const PluginPackageSchema: ZodType<PluginPackageType> = z.object({
  name: z.string(),
  version: z.string(),
  main: z.string().optional(),
  types: z.string().optional(),
  "roster-lock": z.object({
    pluginType: z.enum(Array.from(PLUGIN_TYPES)),
    priority: z.number().optional()
  })
})

export async function importPluginPackage(
  pluginDir: string, packageName: string
){
  const contents = JSON.parse(await readFile(
    pathJoin(pluginDir, "node_modules", packageName, "package.json"),
    "utf-8"
  ))
  const castResult = PluginPackageSchema.safeParse(contents);
  if(!castResult.success){
    throw new Error("Invalid Package.json")
  }
  return castResult.data
}
