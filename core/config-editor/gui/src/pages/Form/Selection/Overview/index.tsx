import { useRosterLock } from "../../Contexts/RosterLock";
import { RosterLockPaths } from "../../../paths";
import { Link, useParams } from "react-router";
import { replaceParams } from "../../../../utils/router";
import { ToolTipSpan } from "../../../../components/ToolTip";
import { Center } from "../../../../components/Center"

import scriptDocsTT from "./script-docs-tt.md";
import scriptDictionaryTT from "./script-dictionary-tt.md";
import globalValTT from "./global-validation-tt.md"
import pieceConfigTT from "./piece-configuration-tt.md";

export function SelectionOverviewPage(){
  const { value } = useRosterLock();
  const params = useParams();
  return (
    <Center>
      <div className="section">
        <h1>
          <ToolTipSpan
            tip={scriptDictionaryTT}
          >Script Dictionary</ToolTipSpan>
        </h1>
        <div>
          <Link
            to={replaceParams(RosterLockPaths.Selection.ScriptDictionary.Docs, params)}
          >
            <ToolTipSpan
              tip={scriptDocsTT}
            >Script Docs</ToolTipSpan>
          </Link>
        </div>
        <div>
          <Link
            to={replaceParams(RosterLockPaths.Selection.ScriptDictionary.AvailableScripts, params)}
          >Available Scripts</Link>
        </div>
        <div>
          <Link
            to={replaceParams(RosterLockPaths.Selection.ScriptDictionary.AddScripts, params)}
          >Add Scripts</Link>
        </div>
        <div>
          <Link
            to={replaceParams(RosterLockPaths.Selection.ScriptDictionary.RunScript, params)}
          >Run Script</Link>
        </div>

      </div>
      <h1 className="section">
        <Link
          to={replaceParams(
            RosterLockPaths.Selection.GlobalValidation, params
          )}
        >
          <ToolTipSpan
            tip={globalValTT}
          >Global Validation</ToolTipSpan>
        </Link>
      </h1>
      <div className="section">
        <h1>
          <ToolTipSpan tip={pieceConfigTT}>Piece Configurations</ToolTipSpan>
        </h1>
        <div className="alternate-list">
          {Object.entries(value.selection.piece).map(([pieceType, pieceConfig]) => (
            <div>
              <Link
                to={replaceParams(
                  RosterLockPaths.Selection.PieceSelection,
                  { filePath: params.filePath, pieceType}
                )}
              >{pieceType}</Link>
            </div>
          ))}
        </div>
      </div>
    </Center>
  )
}

