import { UntrustedScript, ArchiveHandler, Decompressor, ProtocolHandler } from "@roster-lock/types";

export type PluginType = "dl-protocol" | "dl-compression" | "dl-archive" | "untrusted-script";

export const PLUGIN_TYPES = new Set<PluginType>(["dl-protocol", "dl-compression", "dl-archive", "untrusted-script"]);

export type PluginTypeMap = {
  "dl-protocol": ProtocolHandler;
  "dl-compression": Decompressor;
  "dl-archive": ArchiveHandler;
  "untrusted-script": UntrustedScript<any>;
};

export const PLUGIN_TYPE_VALIDATORS: Record<PluginType, (p: Record<string, unknown>) => boolean> = {
  "dl-protocol": (p) =>{
    if(typeof p.name !== "string") return false;
    if(typeof p.validateURL !== "function") return false;
    if(typeof p.download !== "function") return false;
    return true;
  },
  "dl-compression": (p) =>{
    if(typeof p.name !== "string") return false;
    if(!isStringArray(p.extensions)) return false;
    if(typeof p.decompress !== "function") return false;
    return true;

  },
  "dl-archive": (p) =>{
    if(typeof p.name !== "string") return false;
    if(!isStringArray(p.extensions)) return false;
    if(typeof p.extractFiles !== "function") return false;
    return true;
  },
  "untrusted-script": (p) =>{
    if(typeof p.name !== "string") throw new Error("\"name\" should be a string");
    if(!isStringArray(p.extensions)) throw new Error("\"extensions\" should be a string[]");
    if(!isStringArray(p.directoryFile)) throw new Error("\"directoryFile\" should be a string[]");
    if(typeof p.runScript !== "function") throw new Error("\"runScript\" should be a function");
    return true;
  },
};

function isStringArray(v: unknown){
  if(!Array.isArray(v)) return false;
  for(const item of v)
    if(typeof item !== "string") return false;
  return true;
}
