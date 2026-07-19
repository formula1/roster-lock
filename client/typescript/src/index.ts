import { ROSTERLOCK_MATCH_AGENT_URL } from "./constants/match-agent";

export * from "@roster-lock/types";


export * from "./v1/select";
export * from "./v1/sync-dl.ws";
export * from "./v1/sync-dl.http";
export * from "./v1/get-users";
export * from "./v1/file-routes";
export * from "./utils/keys";

export async function validateAuthCode(
  matchAgentAuth: string,
  matchAgentUrl: string | URL = ROSTERLOCK_MATCH_AGENT_URL,
){
  const url = new URL("/validate-authcode", matchAgentUrl);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting The match agent url to be http or https");
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ authCode: matchAgentAuth })
  });

  return response.json();
}
