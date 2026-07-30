import { useAssistantContext } from "../../../globals/assistant";
import "./style.css";

export function AssistantAvatar({ open, onToggle }: { open: boolean, onToggle: () => void }) {
  const { status } = useAssistantContext();
  return (
    <button
      className={`assistant-avatar-button ${open ? "assistant-avatar-button-open" : ""}`}
      onClick={onToggle}
      title="Assistant"
    >
      <span className={`assistant-avatar-status assistant-avatar-status-${status}`} />
      AI
    </button>
  );
}
