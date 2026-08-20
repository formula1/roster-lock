import { HTTPRouter } from "../utils/http-router";
import { WebSocketRouter } from "../utils/websocket-router";
import { createRoom, getMachines, roomWebSocket } from "./room";
import { adminRouter } from "./admin";
import { matchmakerRouter } from "./matchmaker";
import { gameCoordinatorRouter } from "./game-coordinator";

export function createV1Routers() {
  const httpRouter = new HTTPRouter();
  const wsRouter = new WebSocketRouter();

  httpRouter.use("/admin", adminRouter);
  httpRouter.use("/matchmaker", matchmakerRouter);
  httpRouter.use("/game-coordinator", gameCoordinatorRouter);

  httpRouter.post("/room", createRoom);
  httpRouter.get("/room/:roomId/machines", getMachines);

  wsRouter.mount("/room/:roomId", roomWebSocket);

  return { httpRouter, wsRouter };
}
