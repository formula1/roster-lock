

import { createInterface } from "readline";
export function readStdinLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    let resolved = false;
    rl.once("line", line => { resolved = true; rl.close(); resolve(line); });
    rl.once("close", () => { if (!resolved) reject(new Error("stdin closed before receiving data")); });
    rl.once("error", reject);
  });
}

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", chunk => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

export async function* splitStdInByNull(): AsyncIterable<string>{
  let leftover = "";
  for await (let chunk of process.stdin){
    let str: string = leftover + (chunk as Buffer).toString("utf8");
    leftover = "";
    let index: number;
    while ((index = str.indexOf("\0")) !== -1) {
      yield str.slice(0, index);
      str = str.slice(index + 1);
    }
    leftover = str;
  }
  if(leftover) yield leftover;
}

export async function getItemAtOffset<T>(
  iterable: Iterable<T> | AsyncIterable<T>, offset = 0
){
  let currentOffset = 0;
  for await (const item of iterable){
    if(currentOffset === offset) return item;
    currentOffset++;
  }
  throw new Error("Didn't find item");
}
