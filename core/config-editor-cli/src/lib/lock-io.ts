import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { RosterLockV1Config } from "@roster-lock/types";

export function readLock(path: string): RosterLockV1Config {
  const json = JSON.parse(readFileSync(resolve(process.cwd(), path), "utf-8"));
  return ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(json, true);
}

export function writeLock(path: string, lock: RosterLockV1Config): void {
  ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(lock, true);
  writeFileSync(resolve(process.cwd(), path), JSON.stringify(lock, null, 2) + "\n");
}

export function defaultLockPath(title: string, version: string): string {
  return resolve(process.cwd(), `${title}-${version}.rosterlock.json`);
}
