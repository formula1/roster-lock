import { ProtocolHandler } from "@roster-lock/types";

import { download } from "./download";

const Git_Handler: ProtocolHandler = {
  name: "git",
  validateURL(url){
    const parsed = (() => {
      try {
        return new URL(url);
      } catch (e) {
        throw new Error(`Invalid Git URL: ${(e as Error).message}`);
      }
    })();
    
    if (parsed.protocol !== "https:") {
      throw new Error("Git URL must use https:// protocol");
    }
    if (!parsed.hostname) {
      throw new Error("Missing hostname");
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      throw new Error("Git URL must include repository path");
    }
    if(!parsed.pathname.endsWith(".git")){
      throw new Error("Git url pathnames are expected to end with .git")
    }
    return true;
  },
  download
}

export default Git_Handler;
