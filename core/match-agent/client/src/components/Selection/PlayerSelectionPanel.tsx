import { RosterLockV1Config } from "@roster-lock/types";
import { PlayerSlot } from "../../context/JoinSettingsContext";
import { PieceTypePlan } from "./selectionPlan";
import { PieceTypeSection } from "./PieceTypeSection";

export function PlayerSelectionPanel({
  rosterConfig, slot, pieceType, plan, picks, onTogglePick, onReorderPick, matchAgentUrl, matchAgentAuth,
}: {
  rosterConfig: RosterLockV1Config,
  slot: PlayerSlot,
  pieceType: string,
  plan: Extract<PieceTypePlan, { kind: "pickable" }>,
  picks: Array<string>,
  onTogglePick: (pieceId: string) => void,
  onReorderPick: (fromIndex: number, toIndex: number) => void,
  matchAgentUrl: string,
  matchAgentAuth: string,
}) {
  return (
    <div className="player-selection-panel">
      <div className="player-selection-header">
        {slot.label}
        <span className="player-selection-input">
          {slot.input.type === "keyboard" ? "Keyboard" : `Gamepad ${slot.input.index + 1}`}
        </span>
      </div>
      <PieceTypeSection
        rosterConfig={rosterConfig}
        pieceType={pieceType}
        plan={plan}
        picks={picks}
        onTogglePick={onTogglePick}
        onReorderPick={onReorderPick}
        inputSource={slot.input}
        matchAgentUrl={matchAgentUrl}
        matchAgentAuth={matchAgentAuth}
      />
    </div>
  );
}
