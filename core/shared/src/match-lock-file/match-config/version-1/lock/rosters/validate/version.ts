
import { RosterLockV1Config } from "@roster-lock/types";

import { validateSha256 } from "./utils";
export function validateVersions(
  versions: RosterLockV1Config["rosters"][string][0]["version"]
){
  validateSha256(versions.logic);
  validateSha256(versions.media);
  validateSha256(versions.docs);
}