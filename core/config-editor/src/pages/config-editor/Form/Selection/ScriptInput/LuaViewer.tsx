import "./LuaViewer.css";

type TokenType = "keyword" | "string" | "comment" | "number" | "builtin" | "identifier" | "other";
type Token = { type: TokenType; value: string };

const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "goto", "if", "in", "local", "nil", "not", "or",
  "repeat", "return", "then", "true", "until", "while",
]);

// RosterLock script globals and common Lua builtins
const LUA_BUILTINS = new Set([
  "print", "pairs", "ipairs", "type", "tostring", "tonumber",
  "table", "string", "math", "error", "assert", "unpack",
  "select", "pcall", "xpcall", "setmetatable", "getmetatable",
  "rawget", "rawset", "next", "load", "collectgarbage",
  // RosterLock script globals
  "randomFloat", "randomInt", "shuffleIndexes",
  "getPieceMeta", "getAvailablePieces", "require",
  "selection", "users", "pieceTypes", "main",
  "RANDOM", "PIECE_META", "PIECES_AVAILABLE",
  "PLAYER_SELECTION", "EACH_PLAYER_SELECTION", "FINAL_SELECTION",
]);

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Block comment --[[ ]]
    if (code.startsWith("--[[", i)) {
      const end = code.indexOf("]]", i + 4);
      const value = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: "comment", value });
      i += value.length;
      continue;
    }

    // Line comment --
    if (code.startsWith("--", i)) {
      const end = code.indexOf("\n", i);
      const value = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", value });
      i += value.length;
      continue;
    }

    // Long string [[ ]]
    if (code.startsWith("[[", i)) {
      const end = code.indexOf("]]", i + 2);
      const value = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: "string", value });
      i += value.length;
      continue;
    }

    // Quoted strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(code[i]) || (code[i] === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
      let j = i;
      while (j < code.length && /[0-9a-fA-FxX._eE]/.test(code[j])) j++;
      tokens.push({ type: "number", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers, keywords, builtins
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const type: TokenType =
        LUA_KEYWORDS.has(word) ? "keyword"
        : LUA_BUILTINS.has(word) ? "builtin"
        : "identifier";
      tokens.push({ type, value: word });
      i = j;
      continue;
    }

    // Everything else (operators, punctuation, whitespace) — keep as-is
    tokens.push({ type: "other", value: code[i] });
    i++;
  }

  return tokens;
}

function splitIntoLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.value.split("\n");
    lines[lines.length - 1].push({ ...token, value: parts[0] });
    for (let i = 1; i < parts.length; i++) {
      lines.push([{ ...token, value: parts[i] }]);
    }
  }
  return lines;
}

export function LuaViewer({ code }: { code: string }) {
  const lines = splitIntoLines(tokenize(code));
  const lineNumWidth = String(lines.length).length;

  return (
    <pre className="lua-viewer">
      <code>
        {lines.map((lineTokens, lineIndex) => (
          <div key={lineIndex} className="lua-line">
            <span
              className="lua-line-num"
              style={{ minWidth: `${lineNumWidth + 1}ch` }}
            >
              {lineIndex + 1}
            </span>
            {lineTokens.map((token, j) => (
              <span key={j} className={`lua-${token.type}`}>
                {token.value}
              </span>
            ))}
          </div>
        ))}
      </code>
    </pre>
  );
}
