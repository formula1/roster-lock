import { useEffect, useState, useCallback } from "react";
import { listTranscripts, deleteTranscript, type AssistantTranscriptSummary } from "../../../globals/assistant";
import "./style.css";

export function TranscriptList({ onSelect, onNew }: {
  onSelect: (id: string) => void,
  onNew: () => void,
}) {
  const [transcripts, setTranscripts] = useState<Array<AssistantTranscriptSummary> | null>(null);

  const reload = useCallback(() => {
    listTranscripts().then(setTranscripts);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteTranscript(id);
    reload();
  }, [reload]);

  return (
    <div className="assistant-transcript-list">
      <button className="assistant-transcript-list-new" onClick={onNew}>+ New chat</button>
      {transcripts === null && <div className="assistant-transcript-list-empty">Loading…</div>}
      {transcripts?.length === 0 && <div className="assistant-transcript-list-empty">No conversations yet.</div>}
      <ul>
        {transcripts?.map(t => (
          <li key={t.id} onClick={() => onSelect(t.id)}>
            <span className="assistant-transcript-list-title">{t.title}</span>
            <span className="assistant-transcript-list-date">{new Date(t.updatedAt).toLocaleString()}</span>
            <button
              className="assistant-transcript-list-delete"
              title="Delete conversation"
              onClick={e => handleDelete(t.id, e)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
