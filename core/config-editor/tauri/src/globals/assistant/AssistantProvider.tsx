import { createContext, useContext, useEffect, useState, useCallback, type PropsWithChildren } from "react";
import { AssistantSettings, DEFAULT_ASSISTANT_SETTINGS, assistantSettingsStorage } from "./settings";
import { useOllamaStatus, type OllamaStatus } from "./ollama-status";

type AssistantContextValue = {
  settings: AssistantSettings,
  setSettings: (settings: AssistantSettings) => Promise<void>,
  status: OllamaStatus,
  statusError: string | null,
  recheckStatus: () => void,
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

// Settings + connection status are loaded/polled once here and shared via
// context, rather than each consumer (avatar, settings page, chat page)
// polling Ollama independently.
export function AssistantProvider({ children }: PropsWithChildren) {
  const [settings, setSettingsState] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);

  useEffect(() => {
    assistantSettingsStorage.get().then(stored => {
      if (stored) setSettingsState(stored);
    });
  }, []);

  const { status, error, recheck } = useOllamaStatus(settings.baseUrl);

  const setSettings = useCallback(async (next: AssistantSettings) => {
    await assistantSettingsStorage.set(next);
    setSettingsState(next);
  }, []);

  return (
    <AssistantContext.Provider value={{ settings, setSettings, status, statusError: error, recheckStatus: recheck }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistantContext must be used within AssistantProvider");
  return ctx;
}
