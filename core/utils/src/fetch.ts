
import { JSON_Unknown } from "./JSON";

export function fetchBody(method: string, body: JSON_Unknown): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    }
  }
}

export async function handleFetch(fetched: ReturnType<typeof fetch>){
  const response = await fetched;
  const json = await response.json() as JSON_Unknown;

  if(!response.ok){
    throw new FetchError("Fetch Failed", response, json);
  }
  return json;
}


class FetchError extends Error {
  url: string;
  statusCode: number;
  constructor(
    message: string,
    public response: Response,
    public body?: JSON_Unknown,
  ){
    super(message);
    this.url = response.url;
    this.statusCode = response.status;
  }
}
