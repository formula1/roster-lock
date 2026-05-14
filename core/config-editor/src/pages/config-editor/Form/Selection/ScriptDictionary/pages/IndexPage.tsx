
import { RosterLockPaths } from "../../../../paths";
import { Link } from "react-router";
import { replaceParams } from "../../../../../../utils/router";
import { useParams } from "react-router";
import { Center } from "../../../../../../components/Center";

export function ScriptDictionaryIndexPage(){
  const params = useParams();
  const filePath = params.filePath || ""
  return (
    <Center>
    <div>
      <Link
        to={replaceParams(
          RosterLockPaths.Selection.ScriptDictionary.CurrentFiles,
          { filePath }
        )}
      >View Current Files</Link>
    </div>
    <div>
      <Link
        to={replaceParams(
          RosterLockPaths.Selection.ScriptDictionary.MergeFolder,
          { filePath }
        )}
      >Merge a Folder</Link>
    </div>
    <div>
      <Link
        to={replaceParams(
          RosterLockPaths.Selection.ScriptDictionary.RunScript,
          { filePath }
        )}
      >Run a Script</Link>
    </div>
    </Center>
  )
}

