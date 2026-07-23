import { z, ZodType } from "zod";
import semver from "semver";
import type { PluginEntry } from "./index";

export type OfficialPluginEntry = { version: string; priority?: number };
// Keyed by package name (rather than an array of {package, version}) so the
// manifest can't represent the same package twice with conflicting values.
export type OfficialManifest = { plugins: Record<string, OfficialPluginEntry> };

const officialManifestSchema: ZodType<OfficialManifest> = z.object({
  plugins: z.record(z.string(), z.object({
    version: z.string(),
    priority: z.number().optional(),
  })),
});

export async function fetchOfficialManifest(url: string): Promise<OfficialManifest> {
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Failed to fetch official plugin manifest (${res.status} ${res.statusText}): ${url}`);
  const json = await res.json();
  const parsed = officialManifestSchema.safeParse(json);
  if(!parsed.success) throw new Error(`Official plugin manifest at ${url} doesn't match the expected shape`);
  return parsed.data;
}

export type ManifestDiff = {
  missing: Array<{ package: string } & OfficialPluginEntry>;
  outdated: Array<{ package: string, installedVersion: string, officialVersion: string }>;
  priorityMismatch: Array<{ package: string, installedPriority: number, officialPriority: number }>;
  upToDate: Array<string>;
  unlisted: Array<string>;
};

// Compares locally-installed plugins against the official list. `unlisted`
// (installed but not part of the official list) isn't treated as a problem -
// it's just informational, since local/test plugins are expected to exist.
// Priority is only checked once the version already matches - a version
// bump is reported as `outdated` on its own, since installing the update is
// what needs to happen first regardless of priority.
export function diffAgainstOfficial(installed: Array<PluginEntry>, official: OfficialManifest): ManifestDiff {
  const installedByName = new Map(installed.map((p) => [p.package, p]));

  const missing: ManifestDiff["missing"] = [];
  const outdated: ManifestDiff["outdated"] = [];
  const priorityMismatch: ManifestDiff["priorityMismatch"] = [];
  const upToDate: ManifestDiff["upToDate"] = [];

  for(const [packageName, officialEntry] of Object.entries(official.plugins)){
    const installedEntry = installedByName.get(packageName);
    installedByName.delete(packageName);
    if(!installedEntry){
      missing.push({ package: packageName, ...officialEntry });
    } else if(semver.lt(installedEntry.version, officialEntry.version)){
      outdated.push({
        package: packageName,
        installedVersion: installedEntry.version,
        officialVersion: officialEntry.version,
      });
    } else if(typeof officialEntry.priority === "number" && installedEntry.priority !== officialEntry.priority){
      priorityMismatch.push({
        package: packageName,
        installedPriority: installedEntry.priority,
        officialPriority: officialEntry.priority,
      });
    } else {
      upToDate.push(packageName);
    }
  }

  const unlisted = Array.from(installedByName.keys());

  return { missing, outdated, priorityMismatch, upToDate, unlisted };
}
