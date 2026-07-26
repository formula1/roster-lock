import { CSSProperties, useRef, useEffect } from "react";

import "./GlobHighlightInput.css";
/**
 * Tokenizes a glob pattern for syntax highlighting
 * Supports: *, **, ?, [...], {...}, path separators, and <variable> path variables
 */

import { tokenizeGlob, TokenType } from "./tokenizer";

const TOKEN_COLORS: Record<TokenType, string> = {
  text: "inherit",
  pathVariable: "#9D7CD8",    // Purple for variables
  wildcard: "#7AA2F7",        // Blue for *
  globstar: "#BB9AF7",        // Light purple for **
  charClass: "#E0AF68",       // Orange for [...]
  braces: "#F7768E",          // Red for {...}
  question: "#73DACA",        // Teal for ?
  separator: "#565F89",       // Gray for /
  error: "#FF5555",           // Red for errors
};

type GlobHighlightInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  clickableToolTips?: boolean;
  pathVariables: Array<string>;
};

export function GlobHighlightInput({
  value,
  onChange,
  onBlur,
  placeholder,
  style,
  className,
  clickableToolTips = false,
  pathVariables
}: GlobHighlightInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll between input and highlight layer
  useEffect(() => {
    const input = inputRef.current;
    const highlight = highlightRef.current;
    if (!input || !highlight) return;

    const syncScroll = () => {
      highlight.scrollLeft = input.scrollLeft;
    };
    input.addEventListener("scroll", syncScroll);
    return () => input.removeEventListener("scroll", syncScroll);
  }, []);

  const tokens = tokenizeGlob(value, pathVariables);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
      className={className}
    >
      {/* Highlight layer - rendered behind the input */}
      <div
        ref={highlightRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          padding: "1px 2px",
          fontFamily: "monospace",
          fontSize: "inherit",
          lineHeight: "inherit",
          whiteSpace: "pre",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {tokens.map((token, i) => (
          <span
            key={i}
            style={{
              color: TOKEN_COLORS[token.type],
              fontWeight: token.tooltip ? "bold" : "normal",
            }}
            {...!token.tooltip ? {} : {
              "data-tooltip-id": clickableToolTips ? "global-tooltip-clickable" : "global-tooltip-non-clickable",
              "data-tooltip-content": token.tooltip,
            }}
          >
            {token.value}
          </span>
        ))}
        {/* Placeholder when empty */}
        {value === "" && placeholder && (
          <span style={{ color: "#888" }}>{placeholder}</span>
        )}
      </div>

      {/* Actual input - transparent text */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder=""
        style={{
          position: "relative",
          background: "transparent",
          color: "transparent",
          caretColor: "#7AA2F7",
          fontFamily: "monospace",
          fontSize: "inherit",
          width: "100%",
          border: "1px solid #444",
          borderRadius: "4px",
          padding: "1px 2px",
          zIndex: 2,
        }}
      />
    </div>
  );
}

