import { Count } from "@roster-lock/types";

export function parseKeyValueList(value: string | undefined): Record<string, string> {
  if(!value) return {};
  const result: Record<string, string> = {};
  for(const pair of value.split(",")){
    const trimmed = pair.trim();
    if(!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if(eq === -1) throw new Error(`Invalid key=value pair: "${trimmed}"`);
    result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return result;
}

export function parseCommaList(value: string | undefined): Array<string> {
  if(!value) return [];
  return value.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
}

export function parseCount(value: string): Count {
  if(value === "*") return "*";
  if(value.includes(":")){
    const [minRaw, maxRaw] = value.split(":");
    const min = Number.parseInt(minRaw, 10);
    if(Number.isNaN(min)) throw new Error(`Invalid count range: "${value}"`);
    const max: number | "*" = maxRaw === "*" ? "*" : Number.parseInt(maxRaw, 10);
    if(max !== "*" && Number.isNaN(max)) throw new Error(`Invalid count range: "${value}"`);
    return [min, max];
  }
  const n = Number.parseInt(value, 10);
  if(Number.isNaN(n)) throw new Error(`Invalid count: "${value}"`);
  return n;
}

export function parseStrategy(value: string): "mandatory" | "personal" | "shared" | "on demand" {
  const normalized = value === "on-demand" ? "on demand" : value;
  if(!["mandatory", "personal", "shared", "on demand"].includes(normalized)){
    throw new Error(`Invalid strategy: "${value}" (expected mandatory|personal|shared|on-demand)`);
  }
  return normalized as "mandatory" | "personal" | "shared" | "on demand";
}
