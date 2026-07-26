
export function invalidVariableTooltip(variable: string, error: string){
  return `\`<${variable}>\` has an error:\n\n${error}`;
}

export function unclosedBracketTooltip(opener: string, expected: string){
  return `Unclosed \`${opener}\` - missing closing \`${expected}\``;
}

export function invalidCharTooltip(char: string){
  const charCode = char.charCodeAt(0);
  if (charCode < 32) {
    return `Control character (0x${charCode.toString(16).padStart(2, "0")}) is not allowed in file paths`;
  }
  if (charCode === 127) {
    return `DEL character (0x7f) is not allowed in file paths`;
  }
  const descriptions: Record<string, string> = {
    "\\": "Backslash is not allowed - use forward slashes for paths",
    ":": "Colon is not allowed in file paths (reserved on Windows)",
    "\"": "Double quote is not allowed in file paths",
    "|": "Pipe character is not allowed in file paths",
    ">": "Greater-than is not allowed in file paths (use only in `<variable>` syntax)",
  };
  return descriptions[char] ?? `Character \`${char}\` is not allowed in file paths`;
}
