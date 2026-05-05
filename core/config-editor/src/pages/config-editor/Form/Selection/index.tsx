import { useRosterLock } from "../Contexts/RosterLock";
import { useFollowButtons } from "../Contexts/Buttons";
import { FollowButtonForm } from "../../../../components/FollowButtonForm";
import { PieceSelectionConfig } from "./PieceSelectionConfig";
import { GlobalValidation } from "./GlobalValidation";
import type { RosterLockV1Config } from "@roster-lock/types";

type Config = RosterLockV1Config;


function updatePiece(old: Config, pieceType: string, pieceConfig: Config["selection"]["piece"][string]): Config {
  return {
    ...old,
    selection: {
      ...old.selection,
      piece: {
        ...old.selection.piece,
        [pieceType]: pieceConfig,
      },
    },
  };
}

export function SelectionEditPage() {
  const { value, onChange } = useRosterLock();
  const buttons = useFollowButtons();

  return (
    <>
    <h1>Selection Config</h1>
    <div style={{ overflow: "hidden", flexGrow: 1 }}>
      <FollowButtonForm
        info={{ title: "Selection Config" }}
        buttons={buttons}
      >
        <div className="alternate-list">
          {Object.entries(value.engine.pieceDefinitions).map(([pieceType, definition]) => (
            <PieceSelectionConfig
              key={pieceType}
              pieceType={pieceType}
              value={value.selection.piece[pieceType]}
              onChange={pieceConfig =>
                onChange(old => updatePiece(old, pieceType, pieceConfig))
              }
            />
          ))}
        </div>

        <GlobalValidation
          value={value.selection.globalValidation}
          onChange={scripts =>
            onChange(old => ({
              ...old,
              selection: {
                ...old.selection,
                globalValidation: scripts,
              },
            }))
          }
        />
      </FollowButtonForm>
    </div>
    </>
  );
}
