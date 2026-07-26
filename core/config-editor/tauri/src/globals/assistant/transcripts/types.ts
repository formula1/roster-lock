import type { OllamaMessage } from "../types";

export type AssistantTranscript = {
  id: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  messages: Array<OllamaMessage>,
  forkedFrom?: { transcriptId: string, atMessageIndex: number },
};

// Kept separate from AssistantTranscript so the list view can load titles
// without pulling every transcript's full message history into memory.
export type AssistantTranscriptSummary = {
  id: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  // Short snippet of the last user/assistant message, for the avatar preview
  // - avoids needing to load a full transcript just to show what it said.
  lastMessagePreview?: string,
};
