import { ProtocolHandler } from "@roster-lock/types";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { saveStreamToFilesystem } from "@roster-lock/dl-shared";
import { Readable } from "node:stream";

type DLArgs = Parameters<ProtocolHandler["download"]>;

export type S3Location = {
  bucket: string,
  key: string,
  // e.g. "https://s3.amazonaws.com" or "http://localhost:9000" — path-style,
  // bucket is always the first path segment (see parseS3Url).
  endpoint: string,
};

// URL shape: s3://<endpoint-host>[:port]/<bucket>/<key...> (path-style, https)
// or s3+http://<endpoint-host>[:port]/<bucket>/<key...> for plain-http
// endpoints (e.g. a local MinIO instance) — same localhost-only carve-out
// the http protocol plugin uses for http://localhost.
export function parseS3Url(url: string): S3Location {
  const parsed = new URL(url);

  let scheme: "https" | "http";
  if(parsed.protocol === "s3:"){
    scheme = "https";
  } else if(parsed.protocol === "s3+http:"){
    if(parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1"){
      throw new Error("s3+http: is only allowed for localhost/127.0.0.1 endpoints");
    }
    scheme = "http";
  } else {
    throw new Error("Protocol must be s3: or s3+http://localhost");
  }
  if(!parsed.hostname){
    throw new Error("Missing endpoint host");
  }

  const pathParts = parsed.pathname.replace(/^\//, "").split("/");
  const bucket = pathParts.shift();
  if(!bucket){
    throw new Error("Missing bucket name");
  }
  const key = decodeURIComponent(pathParts.join("/"));
  if(!key){
    throw new Error("Missing object key");
  }

  return { bucket, key, endpoint: `${scheme}://${parsed.host}` };
}

function createClient(endpoint: string){
  // Path-style addressing (bucket as first path segment) is used
  // unconditionally since that's how parseS3Url derives the bucket from
  // the URL. Credentials come from the standard AWS SDK resolution chain
  // (env vars / shared config / IAM role) — the URL only ever identifies
  // where the object lives, never secrets.
  return new S3Client({
    endpoint,
    forcePathStyle: true,
    region: process.env.AWS_REGION || "us-east-1",
  });
}

export const runDownloadInit: ProtocolHandler["download"] = async function(
  url: DLArgs[0], folderDestination: DLArgs[1], processHandlers: DLArgs[2],
){
  if(processHandlers.abortSignal.aborted) throw new Error("Download Aborted");

  const { bucket, key, endpoint } = parseS3Url(url);
  const client = createClient(endpoint);

  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { abortSignal: processHandlers.abortSignal }
  );

  if(!response.Body){
    throw new Error("Empty response body");
  }
  const stream = response.Body as unknown as Readable;
  const contentLength = response.ContentLength;
  const processor = processHandlers.getProcessors!(key);

  return {
    finishPromise: saveStreamToFilesystem(
      stream,
      processor,
      folderDestination,
      {
        abortSignal: processHandlers.abortSignal,
        onProgress: processHandlers.onProgress
          ? (bytes) => processHandlers.onProgress!(bytes, contentLength)
          : undefined,
      }
    ),
    metaData: {
      bucket,
      key,
      endpoint,
      etag: response.ETag,
    }
  };
}
