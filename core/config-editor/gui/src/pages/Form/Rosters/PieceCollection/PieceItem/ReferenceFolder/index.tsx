
import { useCallback } from "react";
import { useHost, FOLDER_ACCESS_HINT } from "../../../../../../globals/Host";
import { collectWalkEntries, entriesFileLoader, walkKnownFolder } from "../../../../../../utils/walk";
import { usePromisedMemo, useRunnable, RunnableState } from "../../../../../../utils/react";
import { PieceDefinition, PieceValue } from "../../types";
import { getAssetsOfFiles, calculatePieceVersion } from "@roster-lock/shared";

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
  const host = useHost();
  const existsCheck = usePromisedMemo(async () => {
    if (!value) return null;
    // Hosts without folder access can't say either way - null means the
    // indicator simply doesn't render.
    if (!host.folderExists) return null;
    return await host.folderExists(value);
  }, [host, value]);

  const versionCheck = useRunnable(useCallback(async () => {
    if (!value) throw new Error("No folder selected");
    const walked = await walkKnownFolder(host, value);
    const entries = await collectWalkEntries(walked.entries);
    const { filesWithAssets } = await getAssetsOfFiles(entries.keys(), piece.pathVariables, pieceDefinition);
    return await calculatePieceVersion(filesWithAssets, entriesFileLoader(entries));
  }, [host, value, piece.pathVariables, pieceDefinition]));

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
          {!!host.walkDir && existsCheck.status === "success" && existsCheck.value !== false && (
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
        disabled={!host.walkDir}
        title={!host.walkDir ? FOLDER_ACCESS_HINT : undefined}
        onClick={async () => {
          if (!host.walkDir) return;
          try {
            const walked = await host.walkDir(undefined, { title: 'Select Reference Folder' });
            if (!walked) return;
            onChange(walked.folderToken);
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
