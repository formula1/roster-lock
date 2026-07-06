import { ProtocolHandler } from "@roster-lock/types";

import { isCID } from "cids";
import { download } from "./download";
const IPFS_Handler: ProtocolHandler = {
  name: "ipfs",
  validateURL(url){
    const parsed = new URL(url);
    if (parsed.protocol !== "ipfs:") {
      throw new Error("Protocol must be ipfs:");
    }
    
    // IPFS URLs are in format: ipfs://CID or ipfs://CID/path
    // The hostname is the CID (Content Identifier)
    const cid = parsed.hostname || parsed.pathname.split("/")[0];
    
    if (!cid) {
      throw new Error("IPFS URL must include a CID");
    }
    
    if(!isCID(cid)){
      throw new Error("Invalid IPFS CID");
    }
    return true;
  },
  download
}

export default IPFS_Handler
