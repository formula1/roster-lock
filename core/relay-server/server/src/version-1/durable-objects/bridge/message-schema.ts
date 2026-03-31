import { z, ZodType } from "zod";

type EventMessage = {
  messageType: "event",
  path: string,
  value: string,
};

type RequestMessage = {
  id: string,
  messageType: "request",
  path: string,
  value: any,
};

type ResponseMessage = {
  id: string,
  messageType: "response",
  valueType: "result" | "error",
  value: any,
};

type MessageBridgeMessage = (
  | EventMessage
  | RequestMessage
  | ResponseMessage
);

export const MessageBridgeMessageCaster: ZodType<MessageBridgeMessage> = z.union([
  z.object({
    messageType: z.literal("event"),
    path: z.string(),
    value: z.any(),
  }).strict(),
  z.object({
    messageType: z.literal("request"),
    id: z.string(),
    path: z.string(),
    value: z.any(),
  }).strict(),
  z.object({
    messageType: z.literal("response"),
    id: z.string(),
    valueType: z.enum(["result", "error"]),
    value: z.any(),
  }).strict(),
]);
