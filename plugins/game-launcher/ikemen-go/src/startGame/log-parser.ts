// Parses Ikemen's -log output: a Lua `print(table)`-style dump
// (`table: 0x.. { ["Key"] => value ... }`), which despite the `=>` and
// bracketed keys is not valid Lua - fields aren't comma-separated - so a real
// Lua parser (luaparse) can't read it. This is a dedicated recursive-descent
// parser for that exact shape instead.

// `for await...of` accepts a plain Iterable as well as an AsyncIterable (each
// value is wrapped in an already-resolved promise), so this one generator
// flattens either a full string, an array of chunks, or a stream's chunks
// into a single character stream.
async function* toChars(input: Iterable<string> | AsyncIterable<string>): AsyncGenerator<string> {
  for await (const chunk of input) yield* chunk;
}

// The grammar below needs to look ahead by more than one character (to tell
// "table:" from "true", or to check for a closing "}" before committing to
// another entry), so raw next()/done iteration isn't enough on its own - this
// wraps the char stream with a small pushback buffer to support that.
class PeekBuffer {
  #source: AsyncGenerator<string>;
  #buffer = "";

  constructor(source: AsyncGenerator<string>){
    this.#source = source;
  }

  async #fill(count: number){
    while(this.#buffer.length < count){
      const { value, done } = await this.#source.next();
      if(done) break;
      this.#buffer += value;
    }
  }

  async peek(count = 1): Promise<string> {
    await this.#fill(count);
    return this.#buffer.slice(0, count);
  }

  async consume(count = 1): Promise<string> {
    const chars = await this.peek(count);
    this.#buffer = this.#buffer.slice(chars.length);
    return chars;
  }
}

async function skipWs(reader: PeekBuffer){
  while(/\s/.test(await reader.peek())) await reader.consume();
}

async function expect(reader: PeekBuffer, str: string){
  const got = await reader.consume(str.length);
  if(got !== str){
    throw new SyntaxError(`Expected "${str}", got "${got || "<end of input>"}"`);
  }
}

async function parseString(reader: PeekBuffer): Promise<string> {
  await expect(reader, '"');
  let out = "";
  while((await reader.peek()) !== '"'){
    const ch = await reader.consume();
    if(ch === "") throw new SyntaxError("Unterminated string");
    out += ch === "\\" ? await reader.consume() : ch;
  }
  await reader.consume();
  return out;
}

async function parseNumber(reader: PeekBuffer): Promise<number> {
  let out = "";
  if((await reader.peek()) === "-") out += await reader.consume();
  while(/[0-9.]/.test(await reader.peek())) out += await reader.consume();
  if(out === "" || out === "-"){
    throw new SyntaxError(`Expected a number, got "${await reader.peek(20)}"`);
  }
  return Number(out);
}

// Keys are homogeneous per-table in this format: either all `[N]`
// (an array) or all `["Name"]` (a map) - never mixed.
async function parseKey(reader: PeekBuffer): Promise<string | number> {
  await expect(reader, "[");
  await skipWs(reader);
  const key = (await reader.peek()) === '"' ? await parseString(reader) : await parseNumber(reader);
  await skipWs(reader);
  await expect(reader, "]");
  return key;
}

async function parseTable(reader: PeekBuffer): Promise<Record<string, unknown> | Array<unknown>> {
  await expect(reader, "table:");
  await skipWs(reader);
  while(/[0-9a-fA-Fx]/.test(await reader.peek())) await reader.consume();
  await skipWs(reader);
  await expect(reader, "{");
  await skipWs(reader);

  let isArray = true;
  const entries: Array<[string | number, unknown]> = [];
  while((await reader.peek()) !== "}"){
    const key = await parseKey(reader);
    if(typeof key !== "number") isArray = false
    await skipWs(reader);
    await expect(reader, "=>");
    await skipWs(reader);
    const value = await parseValue(reader);
    entries.push([key, value]);
    await skipWs(reader);
  }
  await expect(reader, "}");

  if(entries.length > 0 && isArray) return entries.map(([, value]) => value);

  const obj: Record<string, unknown> = {};
  for(const [key, value] of entries) obj[String(key)] = value;
  return obj;
}

async function parseValue(reader: PeekBuffer): Promise<unknown> {
  if((await reader.peek(6)) === "table:") return parseTable(reader);
  if((await reader.peek()) === '"') return parseString(reader);
  if((await reader.peek(4)) === "true"){ await reader.consume(4); return true; }
  if((await reader.peek(5)) === "false"){ await reader.consume(5); return false; }
  return parseNumber(reader);
}

// Accepts a whole string, an array of chunks, or an async stream (e.g. a
// `createReadStream(file, "utf8")`) equally - useful for parsing a log
// without buffering the whole file into memory first.
export async function parseIterable(input: Iterable<string> | AsyncIterable<string>): Promise<unknown> {
  const reader = new PeekBuffer(toChars(input));
  await skipWs(reader);
  const result = await parseValue(reader);
  await skipWs(reader);
  const rest = await reader.peek(20);
  if(rest !== ""){
    throw new SyntaxError(`Unexpected trailing content: "${rest}"`);
  }
  return result;
}

export function parseText(text: string): Promise<unknown> {
  return parseIterable([text]);
}
