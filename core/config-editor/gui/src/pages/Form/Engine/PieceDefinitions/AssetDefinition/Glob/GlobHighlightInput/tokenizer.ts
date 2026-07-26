
import { validatePathVariableName } from "@roster-lock/shared";

export type TokenType =
  | "text"
  | "pathVariable"
  | "wildcard"
  | "globstar"
  | "charClass"
  | "braces"
  | "question"
  | "separator"
  | "error";

export type Token = {
  type: TokenType;
  value: string;
  tooltip?: string;
};

// Invalid characters in file paths (controls, and Windows-reserved)
// Note: * ? [ { are valid glob chars, so we don't flag those
const INVALID_PATH_CHARS = /[\x00-\x1f\x7f\\:"|>]/;

import { invalidVariableTooltip, unclosedBracketTooltip, invalidCharTooltip } from "./tooltips";
export function tokenizeGlob(glob: string, pathVariables: Array<string>): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < glob.length) {
    // Check for path variable: <variableName>
    if (glob[i] === "<") {
      const endBracket = glob.indexOf(">", i);
      if (endBracket !== -1) {
        const variableName = glob.slice(i + 1, endBracket);
        const error = (() => {
          try {
            validatePathVariableName(variableName);
            if(!pathVariables.includes(variableName))
              throw new Error(`Variable is not available in list \n\n[${pathVariables.join(", ")}]`);
            return null;
          }catch(error){
            return (error as Error).message;
          }
        })();

        tokens.push({
          type: error ? "error" : "pathVariable",
          value: `<${variableName}>`,
          tooltip: !error ? undefined : invalidVariableTooltip(variableName, error)
        });
        i = endBracket + 1;
        continue;
      } else {
        // Unclosed < - treat rest of string as error
        tokens.push({
          type: "error",
          value: glob.slice(i),
          tooltip: unclosedBracketTooltip("<", ">")
        });
        break;
      }
    }

    // Check for globstar: **
    if (glob[i] === "*" && glob[i + 1] === "*") {
      tokens.push({ type: "globstar", value: "**" });
      i += 2;
      continue;
    }

    // Check for wildcard: *
    if (glob[i] === "*") {
      tokens.push({ type: "wildcard", value: "*" });
      i += 1;
      continue;
    }

    // Check for question mark: ?
    if (glob[i] === "?") {
      tokens.push({ type: "question", value: "?" });
      i += 1;
      continue;
    }

    // Check for character class: [...]
    if (glob[i] === "[") {
      let j = i + 1;
      // Handle negation [! or [^
      if (glob[j] === "!" || glob[j] === "^") j++;
      // Handle ] as first character
      if (glob[j] === "]") j++;
      while (j < glob.length && glob[j] !== "]") j++;
      if (j < glob.length) {
        tokens.push({ type: "charClass", value: glob.slice(i, j + 1) });
        i = j + 1;
        continue;
      } else {
        // Unclosed [ - treat rest of string as error
        tokens.push({
          type: "error",
          value: glob.slice(i),
          tooltip: unclosedBracketTooltip("[", "]")
        });
        break;
      }
    }

    // Check for braces: {...}
    if (glob[i] === "{") {
      let j = i + 1;
      let depth = 1;
      while (j < glob.length && depth > 0) {
        if (glob[j] === "{") depth++;
        if (glob[j] === "}") depth--;
        j++;
      }
      if (depth === 0) {
        tokens.push({ type: "braces", value: glob.slice(i, j) });
        i = j;
        continue;
      } else {
        // Unclosed { - treat rest of string as error
        tokens.push({
          type: "error",
          value: glob.slice(i),
          tooltip: unclosedBracketTooltip("{", "}")
        });
        break;
      }
    }

    // Check for path separator
    if (glob[i] === "/") {
      tokens.push({ type: "separator", value: "/" });
      i += 1;
      continue;
    }

    // Check for invalid character first
    if (INVALID_PATH_CHARS.test(glob[i])) {
      tokens.push({
        type: "error",
        value: glob[i],
        tooltip: invalidCharTooltip(glob[i])
      });
      i++;
      continue;
    }

    // Regular text - collect consecutive valid text characters
    let textEnd = i;
    while (
      textEnd < glob.length &&
      !["*", "?", "[", "{", "/", "<"].includes(glob[textEnd]) &&
      !INVALID_PATH_CHARS.test(glob[textEnd])
    ) {
      textEnd++;
    }
    if (textEnd > i) {
      tokens.push({ type: "text", value: glob.slice(i, textEnd) });
      i = textEnd;
    } else {
      // Fallback for unrecognized characters
      tokens.push({ type: "text", value: glob[i] });
      i++;
    }
  }

  return tokens;
}
