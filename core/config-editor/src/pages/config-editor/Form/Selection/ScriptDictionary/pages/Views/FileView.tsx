import { RosterLockV1Config } from "@roster-lock/types";
import CodeMirror from '@uiw/react-codemirror';

import { getCodeMirrorParser, CODE_MIRROR_EXTENSIONS } from "./constants";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type Script = ScriptDictionary[string];

export function FileView(
  { path, script }: { path: string, script: Script }
){
  const langExtension = getCodeMirrorParser(path)

  if(!langExtension){
    return (
      <h1>Cannot support script {path}</h1>
    )
  }

  return (
    <CodeMirror
      editable={false}
      style={{ width: "100%", height: "100%" }}
      value={script.content}
      extensions={[...CODE_MIRROR_EXTENSIONS, langExtension]}
    />
  );
}

