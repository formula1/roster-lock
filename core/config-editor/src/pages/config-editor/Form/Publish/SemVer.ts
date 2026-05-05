import { JSON_Unknown } from "@roster-lock/utils";

export class SemVer {
  private updateStatus: "none" | "patch" | "minor" | "major" = "none";
  v: {
    major: number,
    minor: number,
    patch: number
  }
  reasons: {
    major: Array<{ reason: string, info: JSON_Unknown }>,
    minor: Array<{ reason: string, info: JSON_Unknown }>,
    patch: Array<{ reason: string, info: JSON_Unknown }>
  } = {
    major: [],
    minor: [],
    patch: [],
  }
  constructor(value: string){
    const parts = value.split(".");
    if(parts.length !== 3) throw new Error("Invalid Semver string");
    this.v = {
      major: SemVer.validateVersion(parts[0], "major"),
      minor: SemVer.validateVersion(parts[1], "minor"),
      patch: SemVer.validateVersion(parts[2], "patch"),
    }
    if(value !== this.toString()){
      throw new Error("Invalid Semver string")
    }
  }

  addMajor(reason: string, info: JSON_Unknown = {}){
    this.reasons.major.push({ reason, info });
    if(this.updateStatus === "major") return;
    this.updateStatus = "major";
    this.v.major += 1;
    this.v.minor = 0;
    this.v.patch = 0;
  }
  addMinor(reason: string, info: JSON_Unknown = {}){
    this.reasons.minor.push({ reason, info });
    if(this.updateStatus === "minor") return;
    this.updateStatus = "minor";
    this.v.minor += 1;
    this.v.patch = 0;
  }
  addPatch(reason: string, info: JSON_Unknown = {}){
    this.reasons.patch.push({ reason, info });
    if(this.updateStatus === "patch") return;
    this.updateStatus = "patch";
    this.v.patch += 1
  }

  toString(){
    return [this.v.major, this.v.minor, this.v.patch].join(".")
  }

  getReasons(){
    return this.reasons;
  }

  static validateVersion(value: string, partName: string){
    const v = Number.parseInt(value)
    if(Number.isNaN(v)) throw new Error(`Invalid Semver string: ${partName} version not an integer`)
    return v
  }
}
