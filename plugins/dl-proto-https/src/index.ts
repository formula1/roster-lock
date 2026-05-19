import { ProtocolHandler } from "@roster-lock/types";

const HTTPS_Handler: ProtocolHandler = {
  name: "https",
  validateURL(url){
    const parsed = new URL(url); // Will throw if invalid URL
    if(parsed.protocol === "http:"){
      if(parsed.hostname !== "locahost"){
        throw new Error("Protocol must be https: or http://localhost");
      }
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Protocol must be https: or http://localhost");
    }
    if (!parsed.hostname) {
      throw new Error("Missing hostname");
    }
    return true;
  }
}

export default HTTPS_Handler;
