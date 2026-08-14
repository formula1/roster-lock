import { useState, useMemo } from "react";
import { RosterLockV1Config, UserSelection } from "@roster-lock/types";
import { PlayerSlot } from "../../context/JoinSettingsContext";
import { PlayerSelectionPanel } from "./PlayerSelectionPanel";
import { planForPieceType, buildUserSelection } from "./selectionPlan";

// Each declared local player slot (see JoinSettingsContext) gets its own
// full panel of pickable piece types - not a single shared grid with a
// cursor that hands off between players. This keeps every slot's picks
// independently mouse-clickable (no "whose turn is it" mode toggle needed
// for the plain-click case) while still layering in a per-slot
// keyboard/gamepad cursor (see PieceTypeSection/useCursorInput). Used inline
// by pages/MatchMaking/Rooms/[roomId] once a room is ready to select in.
export function SelectionBoard({
  rosterConfig, playerSlots, matchAgentUrl, matchAgentAuth, onConfirm,
}: {
  rosterConfig: RosterLockV1Config,
  playerSlots: Array<PlayerSlot>,
  matchAgentUrl: string,
  matchAgentAuth: string,
  onConfirm: (playerSelections: Record<number, UserSelection>) => void,
}) {
  const [picksBySlot, setPicksBySlot] = useState<Record<string, Record<string, Array<string>>>>({});

  const pieceTypePlans = useMemo(
    () => Object.keys(rosterConfig.engine.pieceDefinitions).map((t) => [t, planForPieceType(rosterConfig, t)] as const),
    [rosterConfig]
  );

  const togglePick = (slotId: string, pieceType: string, pieceId: string) => {
    setPicksBySlot((prev) => {
      const slotPicks = prev[slotId] ?? {};
      const current = slotPicks[pieceType] ?? [];
      const plan = pieceTypePlans.find(([t]) => t === pieceType)?.[1];
      let next: Array<string>;
      if (current.includes(pieceId)) {
        next = current.filter((id) => id !== pieceId);
      } else if (plan && plan.kind === "pickable" && current.length >= plan.max) {
        next = current;
      } else {
        next = [...current, pieceId];
      }
      return { ...prev, [slotId]: { ...slotPicks, [pieceType]: next } };
    });
  };

  const allValid = playerSlots.every((slot) => {
    const picks = picksBySlot[slot.id] ?? {};
    return pieceTypePlans.every(([pieceType, plan]) => {
      if (plan.kind !== "pickable") return true;
      const count = (picks[pieceType] ?? []).length;
      return count >= plan.min && count <= plan.max;
    });
  });

  const handleConfirm = () => {
    const result: Record<number, UserSelection> = {};
    playerSlots.forEach((slot, index) => {
      result[index] = buildUserSelection(rosterConfig, picksBySlot[slot.id] ?? {});
    });
    onConfirm(result);
  };

  return (
    <div className="selection-board">
      <div className="selection-board-panels">
        {playerSlots.map((slot) => (
          <PlayerSelectionPanel
            key={slot.id}
            rosterConfig={rosterConfig}
            slot={slot}
            picks={picksBySlot[slot.id] ?? {}}
            onTogglePick={(pieceType, pieceId) => togglePick(slot.id, pieceType, pieceId)}
            matchAgentUrl={matchAgentUrl}
            matchAgentAuth={matchAgentAuth}
          />
        ))}
      </div>
      <button type="button" disabled={!allValid} onClick={handleConfirm}>
        Confirm Selection
      </button>
    </div>
  );
}
