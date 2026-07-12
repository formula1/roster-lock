import { uint8ArrayToHex } from "@roster-lock/utils";
import { stat } from "fs/promises"
import { getConfig, setConfig } from "./config";
import { GenericHandlerCallback } from "@roster-lock/utils"
import { IncomingMessage } from "http";
import { HTTPError } from "./utils/http-router";

function generateAuthCode(length = 32){
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return uint8ArrayToHex(bytes);
}

export async function getDefaultAuthCode(matchAgentConfigFile: string){
  const statInfo = await fileExists(matchAgentConfigFile);
  if(!statInfo) return generateAuthCode();
  if(statInfo.isDirectory()){
    throw new Error("Match Agent config is a directory")
  }
  return (await getConfig(matchAgentConfigFile)).authCode
}

export async function saveAuthCode(matchAgentConfigFile: string, authCode: string){
  await setConfig(matchAgentConfigFile, { authCode })
}

async function fileExists(filePath: string){
  try {
    return await stat(filePath);
  }catch(e){
    return null;
  }
}

export function authMiddleware(authCode: string): GenericHandlerCallback<{ req: IncomingMessage }>{
  return ({ req }, routeInfo, next)=>{
    const authHeader = req.headers["authorization"];
    if(authHeader){
      if(`Bearer ${authCode}` !== authHeader){
        throw new HTTPError(401, "Invalid User")
      }
      return next()
    }
    const searchParams = new URL(req.url || "/", "http://localhost:80");
    const authSearch = searchParams.searchParams.get("authorization");
    if(authSearch){
      if(authCode !== authSearch){
        throw new HTTPError(401, "Invalid User")
      }
      return next()
    }
    throw new HTTPError(401, "User Required")
  }
}

import { jsonBody, HTTPRequestHandler } from "./utils/http-router";
import z, { ZodType } from "zod";
const authCodeSchema: ZodType<{ authCode: string }> = z.object({
  authCode: z.string()
})
export const validateAuthCode: (authCode: string)=>HTTPRequestHandler = (authCode)=>{
  return async ({ req, res })=>{
    const body = await jsonBody(req);
    const parsed = authCodeSchema.safeParse(body);
    if(!parsed.success){
      throw new HTTPError(400, "Bad body")
    }
    const isValid = authCode === parsed.data.authCode;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(isValid));
  }
}
