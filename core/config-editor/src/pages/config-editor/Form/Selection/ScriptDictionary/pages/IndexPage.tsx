
import { RosterLockPaths } from "../../../paths";
import { Link } from "react-router";

import { useURLPrefix } from "../../../Contexts/UrlPrefix"
export function ScriptDictionaryIndexPage(){
  const urlPrefix = useURLPrefix();
  return (
    <>
    <div>
      <Link
        to={urlPrefix + RosterLockPaths.Selection.ScriptDictionary.CurrentFiles}
      >View Current Files</Link>
    </div>
    <div>
      <Link
        to={urlPrefix + RosterLockPaths.Selection.ScriptDictionary.MergeFolder}
      >Merge a Folder</Link>
    </div>
    <div>
      <Link
        to={urlPrefix + RosterLockPaths.Selection.ScriptDictionary.RunScript}
      >Run a Script</Link>
    </div>
    </>
  )
}

