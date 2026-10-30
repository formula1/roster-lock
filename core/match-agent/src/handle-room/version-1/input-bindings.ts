import { jsonBody, HTTPRequestHandler, HTTPError } from "../../utils/http-router";
import { getInputBindings, setInputBindings, inputBindingsSchema } from "../../config/inputBindings";
import { V1Env } from "./globals/types";

export const getInputBindingsRoute: HTTPRequestHandler = async function(this: V1Env, { res }){
  const bindings = await getInputBindings(this.configFilePath);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(bindings));
}

export const setInputBindingsRoute: HTTPRequestHandler = async function(this: V1Env, { req, res }){
  const body = await jsonBody(req);
  const parsed = inputBindingsSchema.safeParse(body);
  if(!parsed.success) throw new HTTPError(400, "Bad Form", parsed.error);

  await setInputBindings(this.configFilePath, parsed.data);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
