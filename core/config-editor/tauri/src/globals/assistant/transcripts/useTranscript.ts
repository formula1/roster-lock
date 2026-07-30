import { useState, useCallback, useEffect, useRef } from "react";
import type { AssistantTranscript } from "./types";
import { createEmptyTranscript, getTranscript, saveTranscript } from "./storage";
import { generateTranscriptTitle } from "./title";
import { runAssistantTurn, AssistantCancelledError } from "../index";
import { DEFAULT_ASSISTANT_SETTINGS, assistantSettingsStorage } from "../settings";
import type { AssistantGlobals } from "../types";
import type { AssistantProgressEvent } from "../progress";

export function useTranscript(id: string | undefined, globals: AssistantGlobals) {
  const [transcript, setTranscript] = useState<AssistantTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Array<AssistantProgressEvent>>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Guards re-entrancy synchronously - `sending` state can't do this alone,
  // since two calls to send() in the same tick both see the pre-render value.
  const sendingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const loaded = id ? await getTranscript(id) : null;
      if (cancelled) return;
      setTranscript(loaded ?? createEmptyTranscript());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const send = useCallback(async (prompt: string) => {
    if (!transcript || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);

    const settings = (await assistantSettingsStorage.get()) ?? DEFAULT_ASSISTANT_SETTINGS;
    const isFirstMessage = transcript.messages.length === 0;

    // Saved immediately, before the model call - so a cancelled or failed
    // turn never loses the user's own prompt.
    const withPrompt: AssistantTranscript = {
      ...transcript,
      messages: [...transcript.messages, { role: "user", content: prompt }],
      updatedAt: new Date().toISOString(),
    };
    setTranscript(withPrompt);
    await saveTranscript(withPrompt);

    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setProgress([]);
    try {
      const nextMessages = await runAssistantTurn(
        withPrompt.messages, globals, settings, controller.signal,
        event => setProgress(prev => [...prev, event]),
      );
      const withResponse: AssistantTranscript = {
        ...withPrompt,
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      };
      setTranscript(withResponse);
      await saveTranscript(withResponse);

      if (isFirstMessage) {
        const title = await generateTranscriptTitle(prompt, settings);
        const titled: AssistantTranscript = { ...withResponse, title };
        setTranscript(titled);
        await saveTranscript(titled);
      }
    } catch (e) {
      if (!(e instanceof AssistantCancelledError)) {
        setError(e instanceof Error ? e.message : String(e));
      }
      // On cancel, withPrompt (already saved above) is left as the final
      // state - no partial assistant message to add.
    } finally {
      sendingRef.current = false;
      setSending(false);
      setProgress([]);
      abortRef.current = null;
    }
  }, [transcript, globals]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { transcript, loading, sending, error, progress, send, cancel };
}
