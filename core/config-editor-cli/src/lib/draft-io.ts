import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { RosterLockV1Draft } from "@roster-lock/types";
import { slugify } from "./slugify";

export const DRAFT_SUFFIX = ".rosterlock.draft.json";

export function resolveDraftPath(explicit?: string): string {
  if(explicit) return resolve(process.cwd(), explicit);

  const cwd = process.cwd();
  const candidates = readdirSync(cwd).filter((name) => name.endsWith(DRAFT_SUFFIX));

  if(candidates.length === 0){
    throw new Error(
      `No draft file found in current directory (expected a *${DRAFT_SUFFIX} file); pass --draft <path>`
    );
  }
  if(candidates.length > 1){
    throw new Error(
      `Multiple draft files found in current directory: ${candidates.join(", ")}; pass --draft <path> to choose one`
    );
  }
  return resolve(cwd, candidates[0]);
}

export function defaultDraftPath(title?: string): string {
  const slug = slugify(title && title.length > 0 ? title : "config") || "config";
  return resolve(process.cwd(), `${slug}${DRAFT_SUFFIX}`);
}

export function readDraft(path: string): RosterLockV1Draft {
  const json = JSON.parse(readFileSync(path, "utf-8"));
  return ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast(json, true);
}

export function writeDraft(path: string, draft: RosterLockV1Draft): void {
  ROSTERLOCK_V1_DRAFT_CASTER_JSONSCHEMA.cast(draft, true);
  writeFileSync(path, JSON.stringify(draft, null, 2) + "\n");
}
