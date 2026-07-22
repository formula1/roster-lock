import { uint8ArrayToHex } from "@roster-lock/utils";
import { GenericHandlerCallback } from "@roster-lock/utils"
import { IncomingMessage } from "http";
import { HTTPError } from "./utils/http-router";

export function generateAuthCode(length = 32){
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return uint8ArrayToHex(bytes);
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
