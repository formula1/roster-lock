import { tmpdir } from "node:os";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { join as pathJoin } from "node:path";
import { z, ZodType } from "zod";
import { PluginManager } from "@roster-lock/plugin-runtime";
import { getAssetsOfFiles, calculatePieceVersion } from "@roster-lock/shared";
import type { ScriptStarter } from "@roster-lock/types";
import { HTTPRouter, HTTPError, jsonBody, HTTPRequest } from "../utils/http-router";
import type { IFolderDB } from "../handle-room/version-1/globals/FolderDB";

// Editor-support API consumed by the config-editor gui's host.plugins
// capability (the PWA host talks to this; the Tauri app runs the same
// operations locally via its sidecar). Mounted at /editor/v1 - its own
// namespace and version axis, deliberately separate from the room-handling
// /v1 protocol so the two can evolve independently.

function sendJSON({ res }: HTTPRequest, value: unknown){
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

// Mirrors the node-sidecar's run-script input validation so both plugin
// backends accept the same payloads.
const PurposeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("piece-user-validation"),
    pieceType: z.string(),
    userId: z.string(),
    input: z.array(z.any()),
  }),
  z.object({
    type: z.literal("piece-merge"),
    pieceType: z.string(),
    users: z.array(z.string()),
    input: z.record(z.string(), z.array(z.any())),
  }),
  z.object({
    type: z.literal("global-validation"),
    pieceTypes: z.array(z.string()),
    users: z.array(z.string()),
    input: z.record(z.string(), z.any()),
  }),
]);

const ScriptConfigSchema: ZodType<Omit<ScriptStarter, "debugLog">> = z.object({
  randomSeeds: z.array(z.string()),
  purpose: PurposeSchema,
  config: z.any(),
  entryScript: z.object({
    src: z.string(),
    method: z.string().optional()
  })
});

const DownloadSourceVersionSchema = z.object({
  source: z.string(),
  pathVariables: z.record(z.string(), z.string()),
  pieceDefinition: z.any(),
});

// A kept-around download the client can list and read - deliberately the
// only way the editor reads files off this machine. Lookups go through the
// collected file map (client input is never joined into a path), so reads
// stay scoped to what this download produced.
type DownloadSession = {
  dir: string,
  files: Map<string, { fullPath: string, size: number }>,
  expiry: NodeJS.Timeout,
};
const DOWNLOAD_SESSION_TTL = 30 * 60_000;

export function createEditorV1Router(plugins: PluginManager, folderDB: IFolderDB){
  const router = new HTTPRouter();

  const downloadSessions = new Map<string, DownloadSession>();

  async function closeDownloadSession(sessionId: string){
    const session = downloadSessions.get(sessionId);
    if(!session) return;
    downloadSessions.delete(sessionId);
    clearTimeout(session.expiry);
    await rm(session.dir, { recursive: true, force: true }).catch((e)=>{
      console.error("Failed to clean up editor download session", session.dir, e);
    });
  }

  function touchDownloadSession(sessionId: string, session: DownloadSession){
    clearTimeout(session.expiry);
    session.expiry = setTimeout(()=>{ closeDownloadSession(sessionId); }, DOWNLOAD_SESSION_TTL);
  }

  router.get("/plugins/download", async (request)=>{
    const [protocol, compression, archive] = await Promise.all([
      listPluginsOfType(plugins, "dl-protocol"),
      listPluginsOfType(plugins, "dl-compression"),
      listPluginsOfType(plugins, "dl-archive"),
    ]);
    sendJSON(request, { protocol, compression, archive });
  });

  router.get("/plugins/script", async (request)=>{
    sendJSON(request, await listPluginsOfType(plugins, "untrusted-script"));
  });

  router.post("/plugins/match-download-protocols", async (request)=>{
    const body = z.object({ url: z.string() }).safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);

    const matching = [];
    for(const protocol of await plugins.getPluginFullOfType("dl-protocol")){
      try {
        if(protocol.module.validateURL(body.data.url)){
          matching.push(pluginInfo(protocol));
        }
      }catch(e){
        // a protocol that can't judge the url just doesn't match it
      }
    }
    sendJSON(request, matching);
  });

  router.post("/run-script", async (request)=>{
    const body = ScriptConfigSchema.safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);

    const scriptConfig: ScriptStarter = { ...body.data, debugLog: [] };
    try {
      const result = await plugins.runUntrustedScript(scriptConfig);
      sendJSON(request, { debugLog: scriptConfig.debugLog, status: "success", result });
    }catch(error){
      // Script-level failures still resolve the request - status carries it,
      // matching the sidecar's behavior.
      sendJSON(request, {
        debugLog: scriptConfig.debugLog,
        status: "fail",
        result: (
          error instanceof Error ? error.message :
          typeof error === "string" ? error :
          JSON.stringify(error)
        ),
      });
    }
  });

  router.post("/download-source-version", async (request)=>{
    const body = DownloadSourceVersionSchema.safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);
    const { source, pathVariables, pieceDefinition } = body.data;

    const downloadDir = await mkdtemp(pathJoin(tmpdir(), "roster-lock-editor-"));
    try {
      const abortController = new AbortController();
      const download = await plugins.downloadToFolder({
        url: source,
        destinationFolder: downloadDir,
        processHandlers: { abortSignal: abortController.signal },
      });
      await download.finishPromise;

      const files = await collectFiles(downloadDir);
      const { filesWithAssets } = await getAssetsOfFiles(
        files.keys(), pathVariables, pieceDefinition
      );
      const version = await calculatePieceVersion(filesWithAssets, async (relativePath)=>{
        const file = files.get(relativePath);
        if(!file) throw new Error("File is not in the download: " + relativePath);
        return { byteSize: file.size, stream: createReadStream(file.fullPath) };
      });
      sendJSON(request, version);
    }finally{
      await rm(downloadDir, { recursive: true, force: true }).catch((e)=>{
        console.error("Failed to clean up editor download dir", downloadDir, e);
      });
    }
  });

  router.post("/download-session", async (request)=>{
    const body = z.object({ source: z.string() }).safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);

    const downloadDir = await mkdtemp(pathJoin(tmpdir(), "roster-lock-editor-"));
    let files: DownloadSession["files"];
    try {
      const abortController = new AbortController();
      const download = await plugins.downloadToFolder({
        url: body.data.source,
        destinationFolder: downloadDir,
        processHandlers: { abortSignal: abortController.signal },
      });
      await download.finishPromise;
      files = await collectFiles(downloadDir);
    }catch(e){
      await rm(downloadDir, { recursive: true, force: true }).catch(()=>{});
      throw e;
    }

    const sessionId = randomUUID();
    const session: DownloadSession = {
      dir: downloadDir,
      files,
      expiry: setTimeout(()=>{ closeDownloadSession(sessionId); }, DOWNLOAD_SESSION_TTL),
    };
    downloadSessions.set(sessionId, session);
    sendJSON(request, {
      sessionId,
      entries: [...files].map(([relativePath, file]) => ({ relativePath, size: file.size })),
    });
  });

  router.post("/download-session/file", async (request)=>{
    const body = z.object({
      sessionId: z.string(),
      relativePath: z.string(),
    }).safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);

    const session = downloadSessions.get(body.data.sessionId);
    if(!session) throw new HTTPError(404, "Unknown download session");
    const file = session.files.get(body.data.relativePath);
    if(!file) throw new HTTPError(404, "File is not in the download");
    touchDownloadSession(body.data.sessionId, session);

    request.res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.size),
    });
    await pipeline(createReadStream(file.fullPath), request.res);
  });

  // Browse every piece the agent has ever completed downloading (they came
  // in through matches via FolderDB.ensurePieceExists) so the editor can add
  // them to a roster without re-downloading anything.
  router.post("/pieces/search", async (request)=>{
    const body = z.object({
      engineName: z.string(),
      pieceType: z.string().optional(),
      search: z.string().optional(),
      page: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(20),
    }).safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);

    sendJSON(request, await folderDB.searchPieces(body.data));
  });

  router.post("/download-session/close", async (request)=>{
    const body = z.object({ sessionId: z.string() }).safeParse(await jsonBody(request.req));
    if(!body.success) throw new HTTPError(400, "Bad body", body.error.issues);
    await closeDownloadSession(body.data.sessionId);
    sendJSON(request, true);
  });

  return router;
}

function pluginInfo(plugin: { module: { name: string, extensions?: Array<string> }, package: { name: string, version: string } }){
  return {
    name: plugin.module.name,
    ...(plugin.module.extensions ? { extensions: plugin.module.extensions } : {}),
    package: { name: plugin.package.name, version: plugin.package.version },
  };
}

async function listPluginsOfType(plugins: PluginManager, type: Parameters<PluginManager["getPluginFullOfType"]>[0]){
  const found = await plugins.getPluginFullOfType(type);
  return found.map(pluginInfo);
}

// relativePath (posix-separated) -> file, for asset matching + hashing
async function collectFiles(root: string){
  const files = new Map<string, { fullPath: string, size: number }>();
  async function walk(dir: string, prefix: string){
    for(const entry of await readdir(dir, { withFileTypes: true })){
      const fullPath = pathJoin(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if(entry.isDirectory()){
        await walk(fullPath, relativePath);
      } else if(entry.isFile()){
        const info = await stat(fullPath);
        files.set(relativePath, { fullPath, size: info.size });
      }
    }
  }
  await walk(root, "");
  return files;
}
