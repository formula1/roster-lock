import { ProtocolHandler } from "@roster-lock/types";

import { runTorrentDownload } from "./download";

const Tor_Handler: ProtocolHandler = {
  name: "torrent",
  validateURL(url){
    const parsed = new URL(url);
    if (parsed.protocol !== "magnet:") {
      throw new Error("Protocol must be magnet:");
    }
    
    // Magnet links must have an xt (exact topic) parameter
    const xt = parsed.searchParams.get("xt");
    if (!xt) {
      throw new Error("Magnet link must include xt (exact topic) parameter");
    }
    
    // xt should be in format urn:btih:<hash>
    if (xt.startsWith("urn:btih:")) {
      const hash = xt.substring("urn:btih:".length);
      // BitTorrent info hash should be
      // 40 hex chars (SHA-1 hex)
      if (/^[a-fA-F0-9]{40}$/.test(hash))
        return true;
      // 32 base32 chars (SHA-1 base32)
      if(/^[a-zA-Z2-7]{32}$/i.test(hash))
        return true;

      throw new Error("Invalid BitTorrent urn:btih hash format");
    } else if(xt.startsWith("urn:btmh:")){
      const hash = xt.substring("urn:btmh:".length);
      // multihash: 1220 prefix (sha2-256) + 64 hex char digest
      if(/^1220[a-fA-F0-9]{64}$/.test(hash))
        return true
      throw new Error("Invalid BitTorrent urn:btmh hash format");
    }
    throw new Error("xt parameter must be in format urn:btih:<hash> or urn:btmh:1220<hash>");
    
  },
  download: runTorrentDownload
}

export default Tor_Handler;

