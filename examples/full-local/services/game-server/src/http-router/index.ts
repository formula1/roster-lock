import express, { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';

export const app = express();
app.use(cors());


// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'game-server' });
});

import { router as webhookRouter } from "./webhook";
import { HTTPError } from '../utils/errors';
app.use("/webhook", webhookRouter);

app.use((req, res, next)=>{
  next(new HTTPError(404, "Not found"))
})

const errorHandler: ErrorRequestHandler = (error, req, res, next)=>{
  const { statusCode, message, body } = (()=>{
    if(error instanceof HTTPError){
      return {
        statusCode: error.statusCode,
        message: error.message,
        body: error.body
      }
    }
    if(error instanceof Error){
      return {
        statusCode: 500,
        message: error.message,
        body: void 0
      }
    }
    return {
      statusCode: 500,
      message: "Unknown Error",
      body: void 0
    }
  })()
  return res.status(statusCode).json({
    message,
    body
  })
}
app.use(errorHandler);
