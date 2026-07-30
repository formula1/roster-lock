export * from "./types"
import { AssistantGlobals, type OllamaMessage, } from "./types";
import { ollamaChat } from "./ollama-client";
import { TOOL_ORGANIZER } from "./tools";
import { AssistantSettings, DEFAULT_ASSISTANT_SETTINGS } from "./settings";
import type { AssistantProgressHandler } from "./progress";

export * from "./docs";
export * from "./pages";
export * from "./tools";
export * from "./settings";
export * from "./hooks";
export * from "./transcripts";
export * from "./progress";
export * from "./ollama-client";
export * from "./ollama-status";
export * from "./AssistantProvider";

export class AssistantCancelledError extends Error {
  constructor(){
    super("Assistant turn cancelled");
    this.name = "AssistantCancelledError";
  }
}

const SYSTEM_PROMPT = [
  "You are an in-app assistant embedded in the RosterLock Config Editor, a desktop app for editing game config drafts.",
  "Answer questions about the app and its config format, and help the user navigate to the right page for a task.",
  "Use read_doc to ground answers in the app's actual docs instead of guessing - don't answer questions about how the editor or config format works from assumption alone.",
  "Use navigate to send the user to a page instead of describing UI you can't see them looking at.",
  "Keep replies short - a sentence or two, not an essay.",
].join(" ");

const MAX_TOOL_ITERATIONS = 10;

export async function runAssistantTurn(
  history: Array<OllamaMessage>,
  handlers: AssistantGlobals,
  settings: AssistantSettings = DEFAULT_ASSISTANT_SETTINGS,
  signal?: AbortSignal,
  onProgress?: AssistantProgressHandler,
): Promise<Array<OllamaMessage>> {
  const messages: Array<OllamaMessage> = [...history];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    if (signal?.aborted) throw new AssistantCancelledError();
    onProgress?.({ type: "thinking" });

    let response;
    try {
      response = await ollamaChat({
        baseUrl: settings.baseUrl,
        model: settings.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        tools: TOOL_ORGANIZER.descriptions,
      }, { signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new AssistantCancelledError();
      throw e;
    }

    messages.push(response.message);

    const toolCalls = response.message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return messages;
    }

    messages.push(...await TOOL_ORGANIZER.runTools(toolCalls, handlers, onProgress))
  }

  throw new Error(`Assistant didn't finish within ${MAX_TOOL_ITERATIONS} tool-call rounds`);
}
