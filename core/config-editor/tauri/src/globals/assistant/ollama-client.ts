import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  OllamaMessage, OllamaToolDescription, OllamaChatResponse, OllamaModelInfo,
} from "./types";

// Uses @tauri-apps/plugin-http instead of the webview's own fetch - requests
// made through this plugin run on the Rust side, so they aren't subject to
// the webview's CORS/origin restrictions the way a plain fetch() to a local
// Ollama server would be.
export async function ollamaChat(request: {
  baseUrl: string,
  model: string,
  messages: Array<OllamaMessage>,
  tools?: Array<OllamaToolDescription>,
}, options?: { signal?: AbortSignal }): Promise<OllamaChatResponse> {
  const response = await tauriFetch(`${request.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      tools: request.tools,
      stream: false,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}): ${await response.text()}`);
  }
  return await response.json();
}

// Ollama tags a model with "tools" in its /api/show capabilities when it
// supports tool calling (also "vision", "embedding", "completion", etc.) -
// this is the documented way to check, there's no flag on /api/tags itself.
export async function ollamaListModels(baseUrl: string): Promise<Array<OllamaModelInfo>> {
  const tagsResponse = await tauriFetch(`${baseUrl}/api/tags`);
  if (!tagsResponse.ok) {
    throw new Error(`Failed to list Ollama models (${tagsResponse.status}): ${await tagsResponse.text()}`);
  }
  const tags = await tagsResponse.json() as {
    models: Array<{ name: string, size: number, details?: { parameter_size?: string, quantization_level?: string } }>,
  };

  return await Promise.all(tags.models.map(async (model) => {
    let capabilities: Array<string> = [];
    try {
      const showResponse = await tauriFetch(`${baseUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.name }),
      });
      if (showResponse.ok) {
        const show = await showResponse.json() as { capabilities?: Array<string> };
        capabilities = show.capabilities ?? [];
      }
    } catch {
      // Leave capabilities empty - still report the model rather than
      // failing the whole list over one model's /api/show call.
    }

    return {
      name: model.name,
      size: model.size,
      parameterSize: model.details?.parameter_size,
      quantizationLevel: model.details?.quantization_level,
      capabilities,
      supportsTools: capabilities.includes("tools"),
    };
  }));
}

export async function checkOllamaStatus(baseUrl: string): Promise<{ available: boolean, error?: string }> {
  try {
    const response = await tauriFetch(`${baseUrl}/api/version`);
    if (!response.ok) return { available: false, error: `Ollama responded with ${response.status}` };
    return { available: true };
  } catch (e) {
    return { available: false, error: e instanceof Error ? e.message : String(e) };
  }
}
