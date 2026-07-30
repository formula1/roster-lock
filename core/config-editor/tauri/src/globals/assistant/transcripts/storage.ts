import { TypedStorageService } from "../../storage";
import type { AssistantTranscript, AssistantTranscriptSummary } from "./types";

const INDEX_KEY = "assistant-transcripts-index";
const transcriptKey = (id: string) => `assistant-transcript-${id}`;

const indexStorage = new TypedStorageService<Array<AssistantTranscriptSummary>>(INDEX_KEY);

function newId(): string {
  return Date.now().toString(32) + Math.random().toString(32).slice(2);
}

export async function listTranscripts(): Promise<Array<AssistantTranscriptSummary>> {
  const index = await indexStorage.get();
  if (!index) return [];
  return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTranscript(id: string): Promise<AssistantTranscript | null> {
  return await new TypedStorageService<AssistantTranscript>(transcriptKey(id)).get();
}

async function upsertIndexEntry(entry: AssistantTranscriptSummary): Promise<void> {
  const index = (await indexStorage.get()) ?? [];
  await indexStorage.set([...index.filter(e => e.id !== entry.id), entry]);
}

const PREVIEW_LENGTH = 140;

function lastMessagePreview(transcript: AssistantTranscript): string | undefined {
  for (let i = transcript.messages.length - 1; i >= 0; i--) {
    const message = transcript.messages[i];
    if ((message.role === "user" || message.role === "assistant") && message.content.trim() !== "") {
      const cleaned = message.content.replace(/\s+/g, " ").trim();
      return cleaned.length > PREVIEW_LENGTH ? `${cleaned.slice(0, PREVIEW_LENGTH - 1)}…` : cleaned;
    }
  }
  return undefined;
}

// Not called on transcript creation - only once a transcript actually has a
// message, so opening a fresh "new chat" doesn't clutter the list until the
// user sends something.
export async function saveTranscript(transcript: AssistantTranscript): Promise<void> {
  await new TypedStorageService<AssistantTranscript>(transcriptKey(transcript.id)).set(transcript);
  await upsertIndexEntry({
    id: transcript.id,
    title: transcript.title,
    createdAt: transcript.createdAt,
    updatedAt: transcript.updatedAt,
    lastMessagePreview: lastMessagePreview(transcript),
  });
}

export async function deleteTranscript(id: string): Promise<void> {
  await new TypedStorageService<AssistantTranscript>(transcriptKey(id)).remove();
  const index = (await indexStorage.get()) ?? [];
  await indexStorage.set(index.filter(e => e.id !== id));
}

export function createEmptyTranscript(): AssistantTranscript {
  const now = new Date().toISOString();
  return { id: newId(), title: "New chat", createdAt: now, updatedAt: now, messages: [] };
}

export async function forkTranscript(
  source: AssistantTranscript, atMessageIndex?: number
): Promise<AssistantTranscript> {
  const now = new Date().toISOString();
  const cutoff = atMessageIndex ?? source.messages.length;
  const fork: AssistantTranscript = {
    id: newId(),
    title: `${source.title} (fork)`,
    createdAt: now,
    updatedAt: now,
    messages: source.messages.slice(0, cutoff).map(m => ({ ...m })),
    forkedFrom: { transcriptId: source.id, atMessageIndex: cutoff },
  };
  await saveTranscript(fork);
  return fork;
}
