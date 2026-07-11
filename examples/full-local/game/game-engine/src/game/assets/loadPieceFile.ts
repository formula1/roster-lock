import path from "path-browserify";
import JSON5 from "json5";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

// Headless (Node) and GUI (Tauri, no node:fs) callers each read piece files off disk in
// their own way, so the engine never touches a filesystem API directly - it's handed one.
export type GetFileContents = (path: string) => Promise<string>;

export async function loadPieceStats<T = any>(
  getFileContents: GetFileContents, folder: string, fileName: string
): Promise<T> {
  return JSON5.parse(await getFileContents(path.join(folder, fileName)));
}

// Piece "logic" files ship as plain ESM data modules (see docs/issues/untrusted-code.md —
// there's no sandboxed executor for piece code yet). We only ever read their declarative
// exports (moveData/stageData/onLoad), never anything a piece author intended as code to
// run against player input, so transpiling and evaluating here is a data load, not
// execution of untrusted logic.
export async function loadPieceModule(
  getFileContents: GetFileContents, folder: string, fileName: string
): Promise<Record<string, any>> {
  const source = await getFileContents(path.join(folder, fileName));
  const { outputText } = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
  });
  const moduleObj: { exports: Record<string, any> } = { exports: {} };
  new Function("module", "exports", outputText)(moduleObj, moduleObj.exports);
  return moduleObj.exports;
}
