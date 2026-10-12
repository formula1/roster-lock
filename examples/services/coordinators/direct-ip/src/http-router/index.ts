import express, { Request, Response, ErrorRequestHandler } from "express";
import cors from "cors";
import { CoordinatorServer } from "@roster-lock/direct-ip-coordinator";
import { createWebhookRouter } from "./webhook";
import { HTTPError } from "../utils/errors";

export function createApp(coordinatorServer: CoordinatorServer) {
  const app = express();
  app.use(cors());

  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", service: "direct-ip-coordinator" });
  });

  app.use("/webhook", createWebhookRouter(coordinatorServer));

  app.use((req, res, next) => {
    next(new HTTPError(404, "Not found"));
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    const { statusCode, message, body } = (() => {
      if(error instanceof HTTPError){
        return { statusCode: error.statusCode, message: error.message, body: error.body };
      }
      if(error instanceof Error){
        return { statusCode: 500, message: error.message, body: void 0 };
      }
      return { statusCode: 500, message: "Unknown Error", body: void 0 };
    })();
    return res.status(statusCode).json({ message, body });
  };
  app.use(errorHandler);

  return app;
}
