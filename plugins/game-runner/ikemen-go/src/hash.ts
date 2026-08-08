import { createHash } from "node:crypto";
import { canonicalJSONStringify, createShaFromJSON } from "@roster-lock/utils";

// Synchronous on purpose: GameRunnerPlugin fields (engineSha) are populated at
// module load, with no top-level await available, and buildArgs.ts needs this
// mid-call rather than as an async step. node:crypto's createHash is sync;
// @roster-lock/utils's createShaFromJSON wraps WebCrypto's subtle.digest and
// is async, so it doesn't fit either use.
export function syncSha256FromJSON(value: unknown): string {
  return createHash("sha256").update(canonicalJSONStringify(value), "utf8").digest("hex");
}
