import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type LightboxContextValue = {
  open: (content: ReactNode) => void;
  close: () => void;
  toggled: boolean
};

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const lightboxDiv = useRef(null);

  const open = useCallback((node: ReactNode) => setContent(node), []);
  const close = useCallback(() => setContent(null), []);

  return (
    <LightboxContext.Provider value={{ open, close, toggled: !!content }}>
      {children}
      {content && (
        <div
          ref={lightboxDiv}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            padding: "5%",
            height: "100vh",
            width: "100vw",
          }}
          onClick={(e)=>{
            if(e.target !== lightboxDiv.current) return;
            close();
          }}
        >
          <div
            style={{
              maxHeight: "100%", width: "100%", overflow: "auto",
            }}
          >{content}</div>
        </div>
      )}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used within LightboxProvider");
  return ctx;
}
