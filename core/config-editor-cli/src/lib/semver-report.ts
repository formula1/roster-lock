import { SemVer } from "@roster-lock/shared";

export function printSemverReasons(semver: SemVer): void {
  const reasons = semver.getReasons();
  for(const level of ["major", "minor", "patch"] as const){
    for(const { reason, info } of reasons[level]){
      console.log(`[${level}] ${reason} ${JSON.stringify(info)}`);
    }
  }
  console.log(`Version: ${semver.toString()}`);
}
