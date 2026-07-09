import { ProtocolHandler } from "@roster-lock/types";
export type ProcessHandlers = Parameters<ProtocolHandler["download"]>[2];
