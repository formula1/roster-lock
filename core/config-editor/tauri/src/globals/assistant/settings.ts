import { TypedStorageService } from "../storage";

export type AssistantSettings = {
  baseUrl: string,
  model: string,
};

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  baseUrl: "http://localhost:11434",
  // A reasonably small model with decent tool-calling support; the user can
  // override this in settings for whatever they've actually pulled.
  model: "qwen2.5:7b",
};

export const assistantSettingsStorage = new TypedStorageService<AssistantSettings>("assistant-settings");
