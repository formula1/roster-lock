import { JSON_Unknown } from "@roster-lock/utils";


export class HTTPError extends Error {
  constructor(
    public url: URL,
    public method: string,
    public response: Response,
    public body: any,
    message: string = `HTTP Error: ${response.status}`
  ){
    super(message);
  }
}

export async function runFetch(
  auth: string | undefined,
  url: string | URL,
  reqInit?: {
    method: string,
    headers?: Record<string, string>,
    body: JSON_Unknown | FormData | ReadableStream
  }
){
  url = new URL(url);
  if(!["http:", "https:"].includes(url.protocol)){
    throw new Error("Expecting protocol to be http or https");
  }

  const { body, headers } = (reqInit || { method: "GET" })
  const isJSONBody = (
    typeof body === "undefined" ? false :
    body instanceof FormData ? false :
    body instanceof ReadableStream ? false :
    true
  )

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(!isJSONBody ? {} : { "Content-Type" : "application/json" }),
      ...(typeof auth === "undefined" ? {} : { "Authorization": "Bearer " + auth }),
      ...headers,
    },
    body: !isJSONBody ? body as FormData | ReadableStream : JSON.stringify(body)
  });

  if(!response.ok){
    throw new HTTPError(
      url, reqInit?.method || "GET", response, await response.json()
    );
  }

  return response;
}
