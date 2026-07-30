import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useAssistantGlobals, useTranscript, forkTranscript, describeProgressEvent, useAssistantContext,
} from "../../../globals/assistant";
import { Markdown } from "../../../components/Markdown";
import "./style.css";

export function TranscriptView({ transcriptId, onForked, onIdReady }: {
  transcriptId?: string,
  onForked?: (newId: string) => void,
  // Called once a transcript that started without a transcriptId (a fresh
  // "new chat") gets its first message saved, so a caller keying UI/routes
  // off transcriptId can pick it up.
  onIdReady?: (id: string) => void,
}) {
  const globals = useAssistantGlobals();
  const { transcript, loading, sending, error, progress, send, cancel } = useTranscript(transcriptId, globals);
  const { status, statusError, recheckStatus } = useAssistantContext();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (transcript && transcript.id !== transcriptId && transcript.messages.length > 0) {
      onIdReady?.(transcript.id);
    }
  }, [transcript, transcriptId, onIdReady]);

  const canSend = status === "available";

  const progressLabel = useMemo(() => {
    for (let i = progress.length - 1; i >= 0; i--) {
      const label = describeProgressEvent(progress[i]);
      if (label) return label;
    }
    return sending ? "Thinking…" : null;
  }, [progress, sending]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || sending || !canSend) return;
    setDraft("");
    send(text);
  }, [draft, sending, canSend, send]);

  const handleFork = useCallback(async () => {
    if (!transcript || transcript.messages.length === 0) return;
    const fork = await forkTranscript(transcript);
    onForked?.(fork.id);
  }, [transcript, onForked]);

  if (loading || !transcript) {
    return <div className="assistant-transcript-view">Loading…</div>;
  }

  const visibleMessages = transcript.messages.filter(
    m => (m.role === "user" || m.role === "assistant") && m.content.trim() !== ""
  );

  return (
    <div className="assistant-transcript-view">
      <div className="assistant-transcript-view-header">
        <span className="assistant-transcript-view-title">{transcript.title}</span>
        <button onClick={handleFork} disabled={transcript.messages.length === 0}>Fork</button>
      </div>

      {status !== "available" && (
        <div className="assistant-status-banner">
          {status === "checking"
            ? "Checking for Ollama…"
            : `Can't reach Ollama${statusError ? ` (${statusError})` : ""} - start it and try again.`}
          <button onClick={recheckStatus}>Check again</button>
        </div>
      )}

      <div className="assistant-transcript-view-messages">
        {visibleMessages.length === 0 && (
          <div className="assistant-transcript-view-empty">Ask a question to get started.</div>
        )}
        {visibleMessages.map((m, i) => (
          <div key={i} className={`assistant-message assistant-message-${m.role}`}>
            <Markdown>{m.content}</Markdown>
          </div>
        ))}
        {sending && progressLabel && (
          <div className="assistant-message assistant-message-assistant assistant-message-progress">
            {progressLabel}
          </div>
        )}
        {error && <div className="assistant-message-error">{error}</div>}
      </div>

      <div className="assistant-transcript-view-input">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={canSend ? "Ask a question…" : "Ollama isn't reachable…"}
          disabled={sending || !canSend}
        />
        {sending
          ? <button onClick={cancel}>Cancel</button>
          : <button onClick={handleSend} disabled={!draft.trim() || !canSend}>Send</button>
        }
      </div>
    </div>
  );
}
