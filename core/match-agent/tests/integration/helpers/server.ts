import { AddressInfo } from "node:net";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { join as pathJoin } from "node:path";
import { mkdir } from "node:fs/promises";

import { PluginManager } from "@roster-lock/plugin-runtime";
import { MatchAgentServer } from "../../../src/server";
import { authMiddleware, validateAuthCode } from "../../../src/authentication";
import { createV1Routers } from "../../../src/handle-room/version-1";
import { createEditorV1Router } from "../../../src/editor-support";
import { createFileSystemRouter } from "../../../src/util-routers/file-system";
import { getSQLite3FolderDB } from "../../../src/handle-room/version-1/globals/FolderDB";

// Mirrors the wiring in src/index.ts#startServer, but keeps a handle to the
// underlying MatchAgentServer/http.Server so tests can bind an ephemeral
// port and shut the server down - startServer() itself returns void.
export async function startTestServer(
  folder: string, authCode: string = randomUUID(), pluginDir?: string, rosterLockFolder?: string
) {
  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res }) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hello: "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode));

  const pluginRuntime = await PluginManager.create(pluginDir ?? folder);
  const fileDB = getSQLite3FolderDB(folder, pluginRuntime);
  // No real match-agent.json is written for a test server - this just
  // gives input-bindings.ts somewhere (inside the test's own temp folder)
  // to resolve its sibling input-bindings.json against.
  const configFilePath = pathJoin(folder, "match-agent.json");
  const resolvedRosterLockFolder = rosterLockFolder ?? pathJoin(folder, "roster-locks");
  await mkdir(resolvedRosterLockFolder, { recursive: true });
  // port isn't known until the ephemeral listen() below resolves - getPort()
  // is only ever called from a request handler, by which point `port` has
  // already been assigned.
  let port = 0;
  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter, env } = createV1Routers(
    fileDB, pluginRuntime, { authCode, getPort: () => port }, configFilePath
  );
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);
  server.httpRouter.use("/editor/v1", authMiddleware(authCode), createEditorV1Router(pluginRuntime, fileDB));
  server.httpRouter.use(
    "/util/file-system", authMiddleware(authCode), createFileSystemRouter(resolvedRosterLockFolder)
  );

  const nodeServer = server.listen(0);
  await once(nodeServer, "listening");
  ({ port } = nodeServer.address() as AddressInfo);

  return {
    authCode,
    port,
    httpUrl: `http://localhost:${port}`,
    wsUrl: `ws://localhost:${port}`,
    rosterLockFolder: resolvedRosterLockFolder,
    // Exposes the same in-memory state the v1 routes themselves read/write
    // (e.g. gameCompletionContext) - lets a test seed or inspect it directly
    // rather than having to drive a real room negotiation (which needs an
    // actual relay server) just to set up a later request.
    env,
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err?: Error) => err ? reject(err) : resolve());
      });
    },
  };
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;

export async function errorBody(res: Response): Promise<{ error: string, context?: unknown }> {
  return res.json() as Promise<{ error: string, context?: unknown }>;
}
