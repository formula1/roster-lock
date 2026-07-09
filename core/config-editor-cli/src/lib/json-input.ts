import { readFile } from "node:fs/promises";
import { ZodType } from "zod";

/**
 * Reads, parses, and validates a JSON argument that names a file, or "-" to read
 * from stdin (for use when the JSON is too large/awkward to pass as a file path,
 * e.g. piped from another command). Requires a zod schema so untrusted JSON is
 * never used until its shape is confirmed.
 */
export async function readJsonInput<T>(source: string, schema: ZodType<T>): Promise<T> {
  const raw = source === "-" ? await readStdin() : await readFile(source, "utf-8");
  return schema.parse(JSON.parse(raw));
}

async function readStdin(): Promise<string> {
  const chunks: Array<Buffer> = [];
  for await (const chunk of process.stdin){
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
