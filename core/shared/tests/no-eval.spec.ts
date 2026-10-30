import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// This package has to run inside Cloudflare Workers, which permanently
// disallow dynamic code generation (`eval`, `new Function(...)`) - ajv's
// default mode relies on exactly that to compile schemas, which is why it
// got replaced with jsonschema (a pure interpreter) everywhere in this
// package. This is a tripwire against that regressing silently: a plain
// text scan of the actual source, not a mock of the restriction, since
// vitest itself runs under plain Node where eval is always allowed and
// wouldn't otherwise notice this class of bug.
const SRC_DIR = join(__dirname, "..", "src");

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp, reason: string }> = [
  { pattern: /\bnew\s+Ajv\s*\(/, reason: "instantiates ajv, which JIT-compiles schemas via eval" },
  { pattern: /\bajv\.compile\s*\(/, reason: "ajv.compile() generates code via eval" },
  { pattern: /\bajv\.validate\s*\(/, reason: "ajv.validate() compiles-and-caches via eval on first use" },
  { pattern: /\bajv\.addSchema\s*\(/, reason: "ajv.addSchema() eventually compiles via eval" },
  { pattern: /\bnew\s+Function\s*\(/, reason: "dynamic code generation, disallowed in Workers" },
  { pattern: /(?<![.\w])eval\s*\(/, reason: "dynamic code generation, disallowed in Workers" },
];

function listTsFiles(dir: string): Array<string> {
  const entries = readdirSync(dir);
  const files: Array<string> = [];
  for(const entry of entries){
    const full = join(dir, entry);
    const stat = statSync(full);
    if(stat.isDirectory()){
      files.push(...listTsFiles(full));
    }else if(entry.endsWith(".ts")){
      files.push(full);
    }
  }
  return files;
}

describe("no dynamic code generation in src/", () => {
  const files = listTsFiles(SRC_DIR);

  it("found at least one source file to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for(const file of files){
    const relative = file.slice(SRC_DIR.length + 1);
    it(`${relative} doesn't use ajv/eval/Function at runtime`, () => {
      const content = readFileSync(file, "utf8");
      for(const { pattern, reason } of FORBIDDEN_PATTERNS){
        expect(pattern.test(content), `${relative}: ${reason}`).toBe(false);
      }
    });
  }
});
