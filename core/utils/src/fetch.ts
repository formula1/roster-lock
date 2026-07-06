
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

export async function handleFetch<T extends JSON_Unknown>(fetched: ReturnType<typeof fetch>): Promise<T>{
  const response = await fetched;
  const json = await response.json();

  if(!response.ok){
    throw new FetchError("Fetch Failed", response, json as JSON_Unknown);
  }
  return json as T;
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
