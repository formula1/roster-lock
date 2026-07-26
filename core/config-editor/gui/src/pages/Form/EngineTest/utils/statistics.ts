
import { type FileTestResult } from "./types";

type StatisticsGroup = {
  files: number;
  bytes: number;
}
export type TestStatistics = {
  total: StatisticsGroup
  logic: StatisticsGroup;
  media: StatisticsGroup;
  doc: StatisticsGroup;
  unmatched: StatisticsGroup;
};

export const DEFAULT_TEST_STATISTICS: TestStatistics = {
  total: { files: 0, bytes: 0 },
  logic: { files: 0, bytes: 0 },
  media: { files: 0, bytes: 0 },
  doc: { files: 0, bytes: 0 },
  unmatched: { files: 0, bytes: 0 },
};

/**
 * Calculate statistics from test results
 */
export function calculateStatistics(results: FileTestResult[]): TestStatistics {
  const stats: TestStatistics = {
    total: { files: 0, bytes: 0 },
    logic: { files: 0, bytes: 0 },
    media: { files: 0, bytes: 0 },
    doc: { files: 0, bytes: 0 },
    unmatched: { files: 0, bytes: 0 },
  };
  
  for (const result of results) {
    updateStatistics(stats, result);
  }
  
  return stats;
}

/**
 * Update statistics incrementally (for streaming)
 */
export function updateStatistics(
  currentStats: TestStatistics,
  newResult: FileTestResult
): TestStatistics {
  
  currentStats.total.files++;
  currentStats.total.bytes += newResult.fileSize;

  if(newResult.matchedAssets.length === 0) {
    currentStats.unmatched.files++;
    currentStats.unmatched.bytes += newResult.fileSize;
    return currentStats;
  }

  const activeAsset = newResult.matchedAssets[0];
  switch(activeAsset.classification) {
    case 'logic':
      currentStats.logic.files++;
      currentStats.logic.bytes += newResult.fileSize;
      break;
    case 'media':
      currentStats.media.files++;
      currentStats.media.bytes += newResult.fileSize;
      break;
    case 'doc':
      currentStats.doc.files++;
      currentStats.doc.bytes += newResult.fileSize;
      break;
  }
  
  return currentStats;
}
