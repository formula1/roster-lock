import { ProtocolHandler } from "@roster-lock/types";

import { runFtpDownload } from "./download";

const FTP_Handler: ProtocolHandler = {
  name: "ftp",
  validateURL(url){
    const parsed = new URL(url);
    const isLocalhostFtp = parsed.protocol === "ftp:" && parsed.hostname === "localhost";
    if (parsed.protocol !== "ftps:" && !isLocalhostFtp) {
      throw new Error("Protocol must be ftps: or ftp://localhost");
    }
    if (!parsed.hostname) {
      throw new Error("Missing hostname");
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      throw new Error("FTPS URL must include a file path");
    }
    return true;
  },
  download: runFtpDownload
}

export default FTP_Handler;
