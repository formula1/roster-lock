import { requireEnv } from "../utils/env";


export const GAME_SERVER = (()=>{
  const envVar = requireEnv("GAME_SERVER");
  const url = new URL(envVar);
  if(url.protocol !== "ws:" && url.protocol !== "wss:"){
    throw new Error("Expecting websocket url")
  }
  return url;
})();


export const PUBLIC_RELAY_SERVER_URL = requireEnv("PUBLIC_RELAY_SERVER_URL");
export const MATCH_AGENT_AUTH = requireEnv("MATCH_AGENT_AUTH");
export const MATCH_AGENT_URL = requireEnv("MATCH_AGENT_URL");
export const PUBLIC_MATCHMAKER_URL = requireEnv("PUBLIC_MATCHMAKER_URL");
