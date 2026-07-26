import { JSON_Unknown } from "@roster-lock/utils";
import { JSONSchemaType, AnySchema } from "ajv";
import type { AssistantPage } from "./pages";

export type AssistantGlobals = {
  navigate: (page: AssistantPage, params: Record<string, string> | undefined, reason: string) => void,
};


export type OllamaToolCall = {
  function: { name: string, arguments: Record<string, JSON_Unknown> },
};

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool",
  content: string,
  tool_calls?: Array<OllamaToolCall>,
  tool_name?: string,
};

export type OllamaTool<T> = {
  name: string,
  description: string,
  parameters: JSONSchemaType<T>,
  progressPendingMessage: string,
  run(args: T, globals: AssistantGlobals): Promise<JSON_Unknown>
};

export type OllamaToolDescription = {
  type: "function",
  function: {
    name: string,
    description: string,
    parameters: AnySchema,
  },
}

export type OllamaChatResponse = {
  message: OllamaMessage,
  done: boolean,
};

export type OllamaModelInfo = {
  name: string,
  size: number,
  parameterSize?: string,
  quantizationLevel?: string,
  capabilities: Array<string>,
  supportsTools: boolean,
};
