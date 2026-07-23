
import { useCallback } from "react";
import { nativeWindow } from "../../../../../../../tauri/window";
import { fs } from "../../../../../../../tauri/fs";
import { usePromisedMemo, useRunnable, RunnableState } from "../../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../../types";
import { getAssetsOfFiles, calculatePieceVersion } from "@roster-lock/shared";
import { join as pathJoin } from "@tauri-apps/api/path";

export function ReferenceFolder({
  value,
  onChange,
  piece,
  pieceDefinition,
}: {
  value: string | undefined,
  onChange: (v: string | undefined) => void,
  piece: PieceValue,
  pieceDefinition: PieceDefinition,
}) {
  const existsCheck = usePromisedMemo(async () => {
    if (!value) return null;
    return await fs.exists(value);
  }, [value]);

  const versionCheck = useRunnable(useCallback(async () => {
    if (!value) throw new Error("No folder selected");
    const files = getRelativeFilesFromFolder(value);
    const { filesWithAssets } = await getAssetsOfFiles(files, piece.pathVariables, pieceDefinition);
    return await calculatePieceVersion(filesWithAssets, async (relativePath) => {
      const fullPath = await pathJoin(value, relativePath);
      const stat = await fs.stat(fullPath);
      return { byteSize: stat.size, stream: fs.getFileStream(fullPath) };
    });
  }, [value, piece.pathVariables, pieceDefinition]));

  return (
    <div className="section">
      <div>Reference Folder</div>
      {value ? (
        <>
          <div>{value}</div>
          {existsCheck.status === "pending" && <div>Checking folder...</div>}
          {existsCheck.status === "success" && existsCheck.value === false && (
            <div className="error">Folder does not exist</div>
          )}
          {existsCheck.status === "success" && existsCheck.value === true && (
            <>
              <button onClick={() => versionCheck.run()}>Check Version</button>
              {versionCheck.state === RunnableState.PENDING && <div>Checking version...</div>}
              {versionCheck.state === RunnableState.FAILED && (
                <div className="error">Version check failed</div>
              )}
              {versionCheck.state === RunnableState.SUCCESS && (() => {
                const v = versionCheck.value;
                const logicOk = v.logic === piece.version.logic;
                const mediaOk = v.media === piece.version.media;
                const docsOk = v.docs === piece.version.docs;
                return (
                  <div>
                    {!logicOk && <div className="error">Logic mismatch: folder {v.logic} / lock {piece.version.logic}</div>}
                    {!mediaOk && <div className="error">Media mismatch: folder {v.media} / lock {piece.version.media}</div>}
                    {!docsOk && <div className="error">Docs mismatch: folder {v.docs} / lock {piece.version.docs}</div>}
                    {logicOk && mediaOk && docsOk && <div>Version matches</div>}
                  </div>
                );
              })()}
            </>
          )}
          <button onClick={() => onChange(undefined)}>Clear Folder</button>
        </>
      ) : (
        <div>No reference folder set</div>
      )}
      <button
        onClick={async () => {
          try {
            const result = await nativeWindow.showOpenDialog({
              title: 'Select Reference Folder',
              properties: ['openDirectory'],
              filters: [],
            });
            if (result.canceled) return;
            if (result.filePaths.length === 0) return;
            onChange(result.filePaths[0]);
          } catch (error) {
            console.error('Error selecting folder:', error);
          }
        }}
      >
        {value ? 'Change Folder' : 'Set Folder'}
      </button>
    </div>
  );
}

async function* getRelativeFilesFromFolder(folderPath: string): AsyncIterable<string> {
  for await (const file of fs.walkDirStream(folderPath)) {
    if (file.is_directory) continue;
    yield file.relative_path;
  }
}
