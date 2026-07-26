import { ollamaChat } from "../ollama-client";
import type { AssistantSettings } from "../settings";

const FALLBACK_TITLE = "New chat";
const MAX_FALLBACK_LENGTH = 60;

function fallbackTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim();
  if (!cleaned) return FALLBACK_TITLE;
  return cleaned.length > MAX_FALLBACK_LENGTH
    ? `${cleaned.slice(0, MAX_FALLBACK_LENGTH - 1)}…`
    : cleaned;
}

// Best-effort - a bad/slow title generation should never block or break
// sending a message, so any failure just falls back to a truncated prompt.
export async function generateTranscriptTitle(
  firstUserMessage: string, settings: AssistantSettings
): Promise<string> {
  try {
    const response = await ollamaChat({
      baseUrl: settings.baseUrl,
      model: settings.model,
      messages: [{
        role: "user",
        content: `Give a short title (3-6 words, no punctuation, no quotes) for a chat that starts with this message:\n\n"""\n${firstUserMessage}\n"""\n\nReply with only the title.`,
      }],
    });
    const title = response.message.content.trim().replace(/^["'`]+|["'`]+$/g, "");
    return title || fallbackTitle(firstUserMessage);
  } catch {
    return fallbackTitle(firstUserMessage);
  }
}
