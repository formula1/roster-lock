import { RosterLockV1Config } from "@roster-lock/types";
import { validateURL } from "./utils";


export function validateHumanInfo(
  humanInfo: RosterLockV1Config["rosters"][string][0]["humanInfo"]
){
  validateFriendlyString(humanInfo.name);
  validateFriendlyString(humanInfo.author);
  validateURL(humanInfo.url);
  if(humanInfo.image) validateURL(humanInfo.image);
}

export function validateFriendlyString(value: string){
  if(!value.trim()) throw new Error("String is required");
  if(value.length > 100) throw new Error("String is too long");
  if(value.length < 3) throw new Error("String is too short");

  if(value.includes('\0')) throw new Error("ID contains null character");
  if(/[\x00-\x1F\x7F-\x9F]/.test(value)) throw new Error("ID contains control character");
  if (/[\r\n\t\v\f]/.test(value)) throw new Error("ID contains whitespace character");
}
