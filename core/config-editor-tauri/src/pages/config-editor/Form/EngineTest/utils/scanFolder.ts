import type { RosterLockEngineConfig } from "@roster-lock/types";
import { fs } from "../../../../../tauri/fs";
import { type FileTestResult } from "./types";

import { getMatchingAssetsForFile } from "@roster-lock/shared";

import { DEFAULT_TEST_STATISTICS, updateStatistics, type TestStatistics } from "./statistics";
import { updateViolations, updateEmptyViolations, type CountViolation } from "./validateAssetCounts";

import { TestFormValue } from "../Form";

import { cloneJSON } from "@roster-lock/utils";

export const DEFAULT_SCAN_UPDATE: ScanUpdateType = {
  results: [],
  statistics: DEFAULT_TEST_STATISTICS,
  countViolations: {},
};

export type ScanUpdateType = {
  results: FileTestResult[];
  statistics: TestStatistics;
  countViolations: Record<string, CountViolation>;
}
export async function scanFolder(
  { folderPath, pieceName, pathVariables }: TestFormValue,
  engineConfig: RosterLockEngineConfig,
  setUpdate: (updatedValue: ScanUpdateType) => void,
){
  const pieceDefinition = engineConfig.pieceDefinitions[pieceName];
  if (!pieceDefinition) {
    throw new Error(`Piece definition not found: ${pieceName}`);
  }

  const readState = cloneJSON(DEFAULT_SCAN_UPDATE);

  for await (const walkResult of fs.walkDirStream(folderPath)){
    // Only process files, skip directories
    if (!walkResult.is_file) return;

    const matchedAssets = getMatchingAssetsForFile(
      pieceDefinition,
      pathVariables,
      walkResult.relative_path,
    );

    const testResult: FileTestResult = {
      filePath: walkResult.path,
      relativePath: walkResult.relative_path,
      matchedAssets,
      fileSize: walkResult.size,
    };

    readState.results = [...readState.results, testResult]
    readState.statistics = updateStatistics(readState.statistics, testResult);
    readState.countViolations = updateViolations(readState.countViolations, testResult);
    setUpdate(readState);
  }

  setUpdate({
    ...readState,
    countViolations: updateEmptyViolations(readState.countViolations, pieceDefinition),
  });
}
