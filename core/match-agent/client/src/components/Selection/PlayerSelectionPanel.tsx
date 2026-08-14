import { RosterLockV1Config } from "@roster-lock/types";
import { PlayerSlot } from "../../context/JoinSettingsContext";
import { planForPieceType } from "./selectionPlan";
import { PieceTypeSection } from "./PieceTypeSection";

export function PlayerSelectionPanel({
  rosterConfig, slot, picks, onTogglePick, matchAgentUrl, matchAgentAuth,
}: {
  rosterConfig: RosterLockV1Config,
  slot: PlayerSlot,
  picks: Record<string, Array<string>>,
  onTogglePick: (pieceType: string, pieceId: string) => void,
  matchAgentUrl: string,
  matchAgentAuth: string,
}) {
  const pieceTypes = Object.keys(rosterConfig.engine.pieceDefinitions);

  return (
    <div className="player-selection-panel">
      <div className="player-selection-header">
        {slot.label}
        <span className="player-selection-input">
          {slot.input.type === "keyboard" ? "Keyboard" : `Gamepad ${slot.input.index + 1}`}
        </span>
      </div>
      {pieceTypes.map((pieceType) => {
        const plan = planForPieceType(rosterConfig, pieceType);
        if (plan.kind === "auto") {
          return (
            <div key={pieceType} className="piece-type-auto">
              {pieceType}: {plan.reason === "mandatory" ? "included automatically" : plan.reason}
            </div>
          );
        }
        if (plan.kind === "unsupported") {
          return (
            <div key={pieceType} className="piece-type-unsupported">
              {pieceType}: {plan.configType} (not user-selectable)
            </div>
          );
        }
        return (
          <PieceTypeSection
            key={pieceType}
            rosterConfig={rosterConfig}
            pieceType={pieceType}
            plan={plan}
            picks={picks[pieceType] ?? []}
            onTogglePick={(pieceId) => onTogglePick(pieceType, pieceId)}
            inputSource={slot.input}
            matchAgentUrl={matchAgentUrl}
            matchAgentAuth={matchAgentAuth}
          />
        );
      })}
    </div>
  );
}
