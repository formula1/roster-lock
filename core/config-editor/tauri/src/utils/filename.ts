// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const ESCAPE_CHAR = "+";


function escapeChar(char: string): string {
  return ESCAPE_CHAR + char.charCodeAt(0).toString(16).padStart(2, "0");
}

export function keyToFilename(key: string): string {
  let result = "";
  for (const char of key) {
    if (char === ESCAPE_CHAR) {
      result += ESCAPE_CHAR + ESCAPE_CHAR;
    } else if (INVALID_CHARS.test(char)) {
      result += escapeChar(char);
    } else {
      result += char;
    }
  }
  return result;
}

export function filenameToKey(filename: string): string {
  let result = "";
  for (let i = 0; i < filename.length; i++) {
    const char = filename[i];
    if (char === ESCAPE_CHAR) {
      const next = filename[i + 1];
      if (next === ESCAPE_CHAR) {
        result += ESCAPE_CHAR;
        i++;
      } else {
        const hex = filename.slice(i + 1, i + 3);
        result += String.fromCharCode(parseInt(hex, 16));
        i += 2;
      }
    } else {
      result += char;
    }
  }
  return result;
}
