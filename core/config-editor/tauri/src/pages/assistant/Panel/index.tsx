import { useState, useCallback } from "react";
import { TranscriptList } from "../TranscriptList";
import { TranscriptView } from "../TranscriptView";
import { AssistantSettingsPage } from "../SettingsPage";
import "./style.css";

type AssistantPanelView = "chat" | "history" | "settings";

// Kept mounted (visibility toggled via CSS, not conditional rendering) so an
// in-progress draft/scroll position survives closing and reopening the panel.
export function AssistantPanel({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [view, setView] = useState<AssistantPanelView>("chat");
  const [transcriptId, setTranscriptId] = useState<string | undefined>(undefined);

  const openTranscript = useCallback((id: string | undefined) => {
    setTranscriptId(id);
    setView("chat");
  }, []);

  return (
    <div className={`assistant-panel ${open ? "assistant-panel-open" : ""}`}>
      <div className="assistant-panel-header">
        <nav className="assistant-panel-tabs">
          <button disabled={view === "chat"} onClick={() => setView("chat")}>Chat</button>
          <button disabled={view === "history"} onClick={() => setView("history")}>History</button>
          <button disabled={view === "settings"} onClick={() => setView("settings")}>Settings</button>
        </nav>
        <button className="assistant-panel-close" onClick={onClose} title="Close">×</button>
      </div>
      <div className="assistant-panel-content">
        {view === "chat" && (
          <TranscriptView
            transcriptId={transcriptId}
            onForked={openTranscript}
            onIdReady={setTranscriptId}
          />
        )}
        {view === "history" && (
          <TranscriptList
            onSelect={openTranscript}
            onNew={() => openTranscript(undefined)}
          />
        )}
        {view === "settings" && <AssistantSettingsPage />}
      </div>
    </div>
  );
}
