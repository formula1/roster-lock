import { ProtocolHandler } from "@roster-lock/types";

import { runFtpDownload } from "./download";

const FTP_Handler: ProtocolHandler = {
  name: "ftp",
  validateURL(url){
    const parsed = new URL(url);
    if (parsed.protocol !== "ftps:") {
      throw new Error("Protocol must be ftps:");
    }
    if (!parsed.hostname) {
      throw new Error("Missing hostname");
    }
    // FTPS URLs should have a path
    if (!parsed.pathname || parsed.pathname === "/") {
      throw new Error("FTPS URL must include a file path");
    }
    return true;
  },
  download: runFtpDownload
}

export default FTP_Handler;
