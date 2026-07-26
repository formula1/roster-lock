
import { RosterLockPaths } from "../../../../paths";
import { Link } from "react-router";
import { replaceParams } from "../../../../../utils/router";
import { useParams } from "react-router";
import { Center } from "../../../../../components/Center";

export function ScriptDictionaryIndexPage(){
  const params = useParams();
  const filePath = params.filePath || ""
  return (
    <Center>
    <div>
      <Link
        to={replaceParams(
          RosterLockPaths.Selection.ScriptDictionary.AvailableScripts,
          { filePath }
        )}
      >View Available Scripts</Link>
    </div>
    <div>
      <Link
        to={replaceParams(
          RosterLockPaths.Selection.ScriptDictionary.AddScripts,
          { filePath }
        )}
      >Add Scripts</Link>
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

