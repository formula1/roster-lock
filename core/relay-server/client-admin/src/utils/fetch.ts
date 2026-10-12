
import { replaceAll } from "./string";

export function replaceParams(pathname: string, params: Record<string, undefined | string>){
  if(!pathname) throw new Error("Path is required");
  if(!params || Object.keys(params).length === 0){
    throw new Error("replaceParams not necessary with no params");
  }
  const endsWithSlash = pathname.at(-1) === "/";
  if(!endsWithSlash) pathname += "/";

  let replaced = pathname;
  for(const [key, value] of Object.entries(params)){
    if(!key) throw new Error("key should never be empty");
    replaced = replaceAll(replaced, `/:${key}/`, `/${value}/`);
  }

  if(!endsWithSlash) replaced = replaced.slice(0, -1);

  return replaced;
}

export function relative(owner: string, subpath: string){
  if(owner.slice(-1) !== "/") owner = owner + "/";
  const index = subpath.indexOf(owner);
  if(index > 0) throw new Error(`subpath ${subpath} is not owned by ${owner}`);
  if(index === -1) throw new Error(`subpath ${subpath} is not owned by ${owner}`);
  return subpath.slice(owner.length);
}

export function addAuthHeader(authToken: string, init: RequestInit = {}): RequestInit{
  init.headers = new Headers(init.headers);
  init.headers.set('Authorization', `Bearer ${authToken}`);
  return init;
}

export async function handleFetch(fetched: ReturnType<typeof fetch>){
  const response = await fetched;
  const json = await response.json();
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
    public body?: any,
  ){
    super(message);
    this.url = response.url;
    this.statusCode = response.status;
  }
}
