import { ProtocolHandler } from "@roster-lock/types";

import { runDownloadInit, parseS3Url } from "./download";

const S3_Handler: ProtocolHandler = {
  name: "s3",
  validateURL(url){
    parseS3Url(url); // Will throw if invalid
    return true;
  },
  download: runDownloadInit
}

export default S3_Handler;
