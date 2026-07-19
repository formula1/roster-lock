import { HTTPError } from "./http-router";

export function handlePagination(search: URLSearchParams){
  const page = handleNumber(search, "page", 0);
  if(page < 0) throw new HTTPError(400, "should be greater than or equal to 0", { key: "page" })
  const limit = handleNumber(search, "limit", 200);
  if(limit <= 0) throw new HTTPError(400, "should be greater than or equal to 0", { key: "limit" })
  return { page, limit }
}

function handleNumber(search: URLSearchParams, key: string, defaultValue: number){
  const value = search.get(key);
  if(value === null) return defaultValue;
  const numValue = Number.parseInt(value);
  if(Number.isNaN(numValue)) throw new HTTPError(400, "invalid number", { key });
  return numValue
}