import { access, constants } from "node:fs/promises";
import { GameRunnerPlugin } from "@roster-lock/types";
import { resolveIkemenBinary } from "./binaryLocation";

export const validateBinaryLocation: GameRunnerPlugin["validateBinaryLocation"] = async(
  binaryLocation, target
)=>{
  const resolvedPath = resolveIkemenBinary(binaryLocation, target);
  // X_OK is meaningless on Windows (fs.access always treats a file as
  // executable there) - checking it only on POSIX avoids a check that can
  // never fail doing nothing useful.
  const mode = target.platform === "win32" ? constants.F_OK : constants.F_OK | constants.X_OK;

  try {
    await access(resolvedPath, mode);
  } catch {
    return {
      valid: false,
      message: `No Ikemen GO build for "${target.platform}" found at "${resolvedPath}".`,
    };
  }
  return { valid: true };
};
