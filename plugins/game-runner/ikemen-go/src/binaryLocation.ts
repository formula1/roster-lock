import { join } from "node:path";
import type { PlatformTarget } from "@roster-lock/types";

// binaryLocation is a folder holding the actual binaries - how it's laid
// out inside is this plugin's own business, not something roster-lock
// prescribes (see docs/v2/binary-location.md). Ikemen GO's official
// releases already sit flat at the root of their own install folder next
// to data/, external/, save/ etc - Ikemen_GO_Linux, Ikemen_GO.exe,
// Ikemen_GO_MacOS - so that's what's expected directly inside
// binaryLocation, no extra nesting.
const EXECUTABLE_NAMES: Partial<Record<PlatformTarget["platform"], string>> = {
  win32: "Ikemen_GO.exe",
  linux: "Ikemen_GO_Linux",
  darwin: "Ikemen_GO_MacOS",
};

export function resolveIkemenBinary(binaryLocation: string, target: PlatformTarget): string {
  const executableName = EXECUTABLE_NAMES[target.platform];
  if(!executableName){
    throw new Error(`ikemen-go: no known Ikemen GO build for platform "${target.platform}"`);
  }
  return join(binaryLocation, executableName);
}
