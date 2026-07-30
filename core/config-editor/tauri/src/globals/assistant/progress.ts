export type AssistantProgressEvent =
  | { type: "thinking" }
  | { type: "tool_start", name: string, message: string, args: Record<string, unknown> }
  | { type: "tool_end", name: string, ok: boolean };

export type AssistantProgressHandler = (event: AssistantProgressEvent) => void;

// tool_start carries its own message (each tool's progressPendingMessage) -
// this just picks which field to show. tool_end has nothing new to say on
// its own; the next event (another tool_start, or the model going quiet
// because it's done) supersedes it.
export function describeProgressEvent(event: AssistantProgressEvent): string | null {
  switch (event.type) {
    case "thinking": return "Thinking…";
    case "tool_start": return event.message;
    case "tool_end": return null;
  }
}
