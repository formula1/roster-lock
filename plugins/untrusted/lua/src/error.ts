
import { NormalizedScriptError, ScriptStackFrame } from "@roster-lock/types";

// Lua traceback line formats:
//   "\t[C]: in ?"                  → C frame, no filename/name
//   "\tscript:5: in local 'fn'"    → Lua frame with name
//   "\tscript:1: in main chunk"    → Lua frame, name is "main chunk"
function parseLuaStack(traceback: string): ScriptStackFrame[] {
  return traceback
    .split("\n")
    .filter(l => l.trim() && !l.trim().startsWith("stack traceback:"))
    .flatMap((line): ScriptStackFrame[] => {
      const trimmed = line.trim();

      if (trimmed.match(/^\[C\]: in \?$/)) return [{ filename: null, line: null, name: null }];

      const luaFrame = trimmed.match(/^([^:]+):(\d+): in (.+)$/);
      if (luaFrame) {
        const named = luaFrame[3].match(/^(?:function|local|method|upvalue|global|field) '([^']+)'$/);
        return [{
          filename: luaFrame[1],
          line: parseInt(luaFrame[2], 10),
          name: named ? named[1] : (luaFrame[3] === "?" ? null : luaFrame[3]),
        }];
      }

      return [];
    });
}

export function parseLuaError(raw: unknown): NormalizedScriptError {
  const rawMessage = (
    raw instanceof Error ? raw.message :
    typeof raw === "string" ? raw :
    String(raw)
  );

  // Split off "stack traceback:" section if present
  const stackIndex = rawMessage.indexOf("\nstack traceback:\n");
  const messagePart = stackIndex === -1 ? rawMessage : rawMessage.slice(0, stackIndex);
  const stack = stackIndex === -1 ? null : parseLuaStack(rawMessage.slice(stackIndex + 1));

  // Lua error format: "script:LINE: MESSAGE" or "[string "name"]:LINE: MESSAGE"
  const match = messagePart.match(/^(?:\[string "([^"]*)"\]|([^:\n]+)):(\d+): ([\s\S]*)$/);
  if (match) {
    return {
      type: "UntrustedScriptError",
      message: match[4],
      filename: match[1] ?? match[2],
      line: parseInt(match[3], 10),
      column: null,
      stack,
    };
  }

  return { type: "UntrustedScriptError", message: messagePart, filename: null, line: null, column: null, stack };
}
