import type { RosterLockEngineConfig } from "@roster-lock/types";
import { type HostFunctions } from "../../../../globals/Host";
import { walkKnownFolder } from "../../../../utils/walk";
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
  host: HostFunctions,
  { folderPath, pieceName, pathVariables }: TestFormValue,
  engineConfig: RosterLockEngineConfig,
  setUpdate: (updatedValue: ScanUpdateType) => void,
){
  const pieceDefinition = engineConfig.pieceDefinitions[pieceName];
  if (!pieceDefinition) {
    throw new Error(`Piece definition not found: ${pieceName}`);
  }

  const readState = cloneJSON(DEFAULT_SCAN_UPDATE);

  const walked = await walkKnownFolder(host, folderPath);
  for await (const entry of walked.entries){
    const matchedAssets = getMatchingAssetsForFile(
      pieceDefinition,
      pathVariables,
      entry.relativePath,
    );

    const testResult: FileTestResult = {
      filePath: entry.fileToken,
      relativePath: entry.relativePath,
      matchedAssets,
      fileSize: entry.size,
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
