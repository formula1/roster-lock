
import { NormalizedScriptError, ScriptStackFrame } from "@roster-lock/types";
import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten";

// QuickJS stack frame formats:
//   "    at funcName (filename:line:col)"  → named frame
//   "    at funcName (filename:line)"      → named frame, no column
//   "    at filename:line:col"             → anonymous frame
function parseTSStack(stack: string): ScriptStackFrame[] {
  return stack
    .split("\n")
    .filter(l => l.trim().startsWith("at "))
    .flatMap((line): ScriptStackFrame[] => {
      const trimmed = line.trim().slice(3); // remove "at "

      // "funcName (filename:line:col)" or "funcName (filename:line)"
      const named = trimmed.match(/^(.+?) \(([^)]*):(\d+)(?::\d+)?\)$/);
      if (named) {
        return [{ filename: named[2] || null, line: parseInt(named[3], 10), name: named[1] }];
      }

      // "filename:line:col" or "filename:line" (anonymous)
      const anon = trimmed.match(/^(.+):(\d+)(?::\d+)?$/);
      if (anon) {
        const filename = anon[1] === "<anonymous>" ? null : anon[1];
        return [{ filename, line: parseInt(anon[2], 10), name: null }];
      }

      return [];
    });
}

export function extractQuickJSError(vm: QuickJSContext, errorHandle: QuickJSHandle): NormalizedScriptError {
  // Handle plain string throws
  if (vm.typeof(errorHandle) === "string") {
    return { type: "UntrustedScriptError", message: vm.getString(errorHandle), filename: null, line: null, column: null, stack: null };
  }

  const messageHandle = vm.getProp(errorHandle, "message");
  const message = vm.typeof(messageHandle) === "string" ? vm.getString(messageHandle) : String(vm.dump(errorHandle));
  messageHandle.dispose();

  const stackHandle = vm.getProp(errorHandle, "stack");
  const stackStr = vm.typeof(stackHandle) === "string" ? vm.getString(stackHandle) : null;
  stackHandle.dispose();

  const stack = stackStr ? parseTSStack(stackStr) : null;
  const firstFrame = stack?.[0] ?? null;

  return {
    type: "UntrustedScriptError",
    message,
    filename: firstFrame?.filename ?? null,
    line: firstFrame?.line ?? null,
    column: null,
    stack,
  };
}
