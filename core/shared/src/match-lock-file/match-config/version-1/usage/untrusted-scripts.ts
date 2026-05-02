type UntrustedScript = {
  name: string,
  mimeTypes: Array<string>,
};
export const UNTRUSTED_SCRIPT_TYPES: Record<string, UntrustedScript> = {};

export function getUntrustedScript(mimetype: string){
  for(const script of Object.values(UNTRUSTED_SCRIPT_TYPES)){
    if(script.mimeTypes.includes(mimetype)){
      return script;
    }
  }
}

UNTRUSTED_SCRIPT_TYPES["lua"] = {
  name: "lua",
  mimeTypes: [ "text/lua", "text/x-lua" ]
};
