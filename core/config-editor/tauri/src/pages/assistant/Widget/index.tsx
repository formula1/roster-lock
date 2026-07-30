import { useState, useCallback } from "react";
import { AssistantAvatar } from "../Avatar";
import { AssistantPanel } from "../Panel";

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(o => !o), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <AssistantAvatar open={open} onToggle={toggle} />
      <AssistantPanel open={open} onClose={close} />
    </>
  );
}
