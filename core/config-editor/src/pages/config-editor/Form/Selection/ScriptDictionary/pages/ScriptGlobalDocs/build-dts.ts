import type { RosterLockV1Config } from "@roster-lock/types";
import { PURPOSE_GLOBALS, PURPOSE_RETURN } from "./constants";
import { SCRIPT_PURPOSES } from "../RunScript/script-purpose";

function toPascalCase(s: string) {
  return s.replace(/(^|[-_\s])([a-z\d])/gi, (_, __, c: string) => c.toUpperCase());
}

export function buildDts(lock: RosterLockV1Config): string {
  const lines: string[] = [];

  lines.push("// match-lock script globals");
  lines.push("");
  lines.push("type PieceId = string;");
  lines.push("type PieceType = string;");
  lines.push("");
  lines.push("interface SelectedPiece {");
  lines.push("  id: PieceId;");
  lines.push("  required: Record<PieceType, {");
  lines.push("    mandatory: SelectedPiece[];");
  lines.push("    selectable: SelectedPiece[];");
  lines.push("  }>;");
  lines.push("}");
  lines.push("");

  const metaInterfaces: Array<{ pieceType: string; name: string }> = [];
  for (const pieceType of Object.keys(lock.selection.piece)) {
    const schema = lock.selection.piece[pieceType]?.pieceMeta?.schema;
    if (!schema || Object.keys(schema).length === 0) continue;
    const name = toPascalCase(pieceType) + "Meta";
    metaInterfaces.push({ pieceType, name });
    lines.push(`interface ${name} {`);
    for (const [field, fieldType] of Object.entries(schema)) {
      lines.push(`  ${field}: ${fieldType};`);
    }
    lines.push("}");
    lines.push("");
  }

  lines.push("// Common globals");
  lines.push("declare function randomFloat(): number;");
  lines.push("declare function randomInt(min: number, max: number): number;");
  lines.push("declare function shuffleIndexes(length: number): number[];");
  for (const { pieceType, name } of metaInterfaces) {
    lines.push(`declare function getPieceMeta(pieceType: "${pieceType}", pieceId: PieceId): ${name};`);
  }
  lines.push("declare function getPieceMeta(pieceType: PieceType, pieceId: PieceId): Record<string, string | number | boolean | string[] | number[] | boolean[]>;");
  lines.push("declare function getAvailablePieces(pieceType: PieceType): string[];");
  lines.push("");
  lines.push("// Script context - use scriptPurpose to narrow");
  lines.push("type Globals = (");
  for (const purpose of SCRIPT_PURPOSES) {
    const globals = PURPOSE_GLOBALS[purpose.value];
    const returnType = PURPOSE_RETURN[purpose.value];
    lines.push("  | {");
    for (const g of globals) {
      const comment = g.name === "scriptPurpose" ? ` // return: ${returnType}` : "";
      lines.push(`    ${g.name}: ${g.type},${comment}`);
    }
    lines.push("  }");
  }
  lines.push(");");

  return lines.join("\n");
}


import { showSaveDialog } from "../../../../../../../tauri/window";
import { fs } from "../../../../../../../tauri/fs";

export async function downloadDts(content: string, filename: string) {
  const { canceled, filePath } = await showSaveDialog({
    title: "Save Type Definitions",
    defaultPath: filename,
    filters: [{ name: "TypeScript Declaration", extensions: ["d.ts"] }],
  });
  if (canceled || !filePath) return;
  await fs.writeFile(filePath, new TextEncoder().encode(content));
}


