import type { OllamaTool } from "../types";
import { fs } from "../../../tauri/fs";

const MAX_DIR_ENTRIES = 500;
const MAX_TEXT_FILE_BYTES = 100_000;

export const LIST_DIRECTORY_TOOL: OllamaTool<{ path: string }> = {
  name: "list_directory",
  description: "List the immediate contents of a folder (name + whether it's a file or directory). Use this to see what's in a piece's folder before deciding which files to read.",
  progressPendingMessage: "Looking in a folder…",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute path to the folder." },
    },
    required: ["path"],
  },
  async run({ path }) {
    let entries;
    try {
      entries = await fs.readDir(path);
    } catch (e) {
      return { error: `Failed to read directory: ${e instanceof Error ? e.message : String(e)}` };
    }
    return {
      entries: entries.slice(0, MAX_DIR_ENTRIES).map(entry => ({
        name: entry.name,
        type: entry.is_directory ? "directory" : "file",
      })),
      truncated: entries.length > MAX_DIR_ENTRIES,
    };
  },
};

export const READ_FILE_TEXT_TOOL: OllamaTool<{ path: string }> = {
  name: "read_file_text",
  description: "Read a file's contents as text, whatever its extension (game asset formats often use non-standard text extensions, e.g. MUGEN's .def/.cmd/.cns/.air/.snd are all plain text). Content is sniffed rather than gated by extension - actual binary files (images, archives, audio/video, etc.) are refused with an error instead of returning garbage. Files over ~100KB are truncated.",
  progressPendingMessage: "Reading a file…",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute path to the file." },
    },
    required: ["path"],
  },
  async run({ path }) {
    let stat;
    try {
      stat = await fs.stat(path);
    } catch (e) {
      return { error: `Failed to stat file: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (!stat.is_file) {
      return { error: "Path is not a file." };
    }

    let bytes: Uint8Array;
    try {
      bytes = await fs.readFile(path);
    } catch (e) {
      return { error: `Failed to read file: ${e instanceof Error ? e.message : String(e)}` };
    }

    const truncated = bytes.length > MAX_TEXT_FILE_BYTES;
    const slice = truncated ? bytes.subarray(0, MAX_TEXT_FILE_BYTES) : bytes;

    // NUL bytes essentially never appear in real text files - a cheap,
    // reliable binary sniff that works regardless of extension.
    if (slice.includes(0)) {
      return { error: "File appears to be binary (contains NUL bytes) - refusing to read as text." };
    }

    try {
      // fatal: true so invalid byte sequences throw instead of silently
      // decoding into a page of U+FFFD replacement characters - which is
      // what a lossy decode of e.g. a PNG produces: a wall of garbage that
      // burns the model's context and tells it nothing.
      const text = new TextDecoder("utf-8", { fatal: true }).decode(slice);
      return { text, truncated, sizeBytes: stat.size };
    } catch {
      return { error: "File is not valid UTF-8 text (likely binary) - refusing to read." };
    }
  },
};
