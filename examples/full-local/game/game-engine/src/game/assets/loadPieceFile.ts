import JSON5 from "json5";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { RosterLockV1Config } from "@roster-lock/types";
import { getPiece, getPieceFileContents } from "@roster-lock/ts-client";

// Headless and browser (PWA) callers both fetch a piece's files the same way:
// over HTTP from match-agent's /v1/piece/file-contents route, identified by
// {engine, pieceType, piece: {version, pathVariables}} rather than a
// filesystem path - match-agent resolves the on-disk folder itself (it's
// fixed for the whole match-agent process, set at its own startup), so this
// only needs enough info to name the piece, not where it lives on disk.
export type PieceFilesConfig = {
  rosterConfig: RosterLockV1Config,
  matchAgentAuth: string,
  matchAgentUrl: string | URL,
}

async function fetchPieceFileText(
  pieceFiles: PieceFilesConfig, pieceType: string, pieceId: string, fileName: string
): Promise<string> {
  const piece = getPiece(pieceFiles.rosterConfig, pieceType, pieceId);
  const stream = await getPieceFileContents(
    {
      version: 1,
      engine: pieceFiles.rosterConfig.engine,
      pieceType,
      piece: { version: piece.version, pathVariables: piece.pathVariables },
      filePath: fileName,
    },
    pieceFiles.matchAgentAuth,
    pieceFiles.matchAgentUrl,
  );
  if(!stream) throw new Error(`Empty response body for ${fileName}`);
  return new Response(stream).text();
}

export async function loadPieceStats<T = any>(
  pieceFiles: PieceFilesConfig, pieceType: string, pieceId: string, fileName: string
): Promise<T> {
  return JSON5.parse(await fetchPieceFileText(pieceFiles, pieceType, pieceId, fileName));
}

// Piece "logic" files ship as plain ESM data modules (see docs/issues/untrusted-code.md —
// there's no sandboxed executor for piece code yet). We only ever read their declarative
// exports (moveData/stageData/onLoad), never anything a piece author intended as code to
// run against player input, so transpiling and evaluating here is a data load, not
// execution of untrusted logic.
export async function loadPieceModule(
  pieceFiles: PieceFilesConfig, pieceType: string, pieceId: string, fileName: string
): Promise<Record<string, any>> {
  const source = await fetchPieceFileText(pieceFiles, pieceType, pieceId, fileName);
  const { outputText } = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
  });
  const moduleObj: { exports: Record<string, any> } = { exports: {} };
  new Function("module", "exports", outputText)(moduleObj, moduleObj.exports);
  return moduleObj.exports;
}
