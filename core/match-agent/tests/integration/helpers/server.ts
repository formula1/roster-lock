import { AddressInfo } from "node:net";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

import { MatchAgentServer } from "../../../src/server";
import { authMiddleware, validateAuthCode } from "../../../src/authentication";
import { createV1Routers } from "../../../src/handle-room/version-1";

// Mirrors the wiring in src/index.ts#startServer, but keeps a handle to the
// underlying MatchAgentServer/http.Server so tests can bind an ephemeral
// port and shut the server down - startServer() itself returns void.
export async function startTestServer(authCode: string = randomUUID()) {
  const server = new MatchAgentServer();
  server.httpRouter.get("/", ({ res }) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hello: "world" }));
  });
  server.httpRouter.post("/validate-authcode", validateAuthCode(authCode));

  const { httpRouter: v1HttpRouter, wsRouter: v1WsRouter } = createV1Routers();
  server.httpRouter.use("/v1", authMiddleware(authCode), v1HttpRouter);
  server.wsRouter.use("/v1", authMiddleware(authCode), v1WsRouter);

  const nodeServer = server.listen(0);
  await once(nodeServer, "listening");
  const { port } = nodeServer.address() as AddressInfo;

  return {
    authCode,
    port,
    httpUrl: `http://localhost:${port}`,
    wsUrl: `ws://localhost:${port}`,
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
