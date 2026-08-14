import { ReactNode } from "react";

// Generic overlay used by pages/MatchMaking to host whichever bridge request
// is currently pending (installGameRunnerPlugin or requestSelection) -
// rendered by the host shell, on top of the matchmaker <iframe>, never
// inside it.
export function Lightbox({ children, onClose }: { children: ReactNode, onClose?: () => void }) {
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
