import CodeMirrorMerge from "react-codemirror-merge";
import { EditorState } from "@codemirror/state";
import { getCodeMirrorParser, CODE_MIRROR_EXTENSIONS } from "./constants";
import { ReactNode } from "react";

const readOnly = EditorState.readOnly.of(true);

export function DiffView({
  path,
  configContent,
  fileContent,
  onUseFile,
  onKeepConfig,
  description = null
}: {
  path: string,
  configContent: string;
  fileContent: string;
  onUseFile: () => void;
  onKeepConfig: () => void;
  description?: ReactNode
}) {
  const langExtension = getCodeMirrorParser(path)

  if(!langExtension){
    return (
      <h1>Cannot support script {path}</h1>
    )
  }

  const extensions = [...CODE_MIRROR_EXTENSIONS, langExtension, readOnly];

  return (
    <>
      {description}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
        <span>Config ← diff → File</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onKeepConfig}>Keep config version</button>
          <button onClick={onUseFile}>Use file version</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <CodeMirrorMerge orientation="a-b">
          <CodeMirrorMerge.Original value={configContent} extensions={extensions} />
          <CodeMirrorMerge.Modified value={fileContent} extensions={extensions} />
        </CodeMirrorMerge>
      </div>
    </>
  );
}
