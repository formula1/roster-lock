import { useState, useMemo } from "react";
import { RosterLockV1Config, UserSelection } from "@roster-lock/types";
import { PlayerSlot } from "../../context/JoinSettingsContext";
import { PlayerSelectionPanel } from "./PlayerSelectionPanel";
import { PieceTypeTabs } from "./PieceTypeTabs";
import { planForPieceType, buildUserSelection, PieceTypePlan } from "./selectionPlan";

type PickablePlan = Extract<PieceTypePlan, { kind: "pickable" }>;

// Each declared local player slot (see JoinSettingsContext) gets its own
// panel, but only for the one piece type the shared tab bar has active -
// this keeps the board from stacking every piece type for every slot into
// one long scroll. Picks persist per slot/piece-type while a tab is
// inactive, so switching tabs never loses work. Used inline by
// pages/MatchMaking/Rooms/[roomId] once a room is ready to select in.
export function SelectionBoard({
  rosterConfig, playerSlots, pluginName, matchAgentUrl, matchAgentAuth, onConfirm, onCancel,
}: {
  rosterConfig: RosterLockV1Config,
  playerSlots: Array<PlayerSlot>,
  pluginName: string,
  matchAgentUrl: string,
  matchAgentAuth: string,
  onConfirm: (playerSelections: Record<number, UserSelection>) => void,
  onCancel: () => void,
}) {
  const [picksBySlot, setPicksBySlot] = useState<Record<string, Record<string, Array<string>>>>({});

  const pieceTypePlans = useMemo(
    () => Object.keys(rosterConfig.engine.pieceDefinitions).map((t) => [t, planForPieceType(rosterConfig, t)] as const),
    [rosterConfig]
  );

  const pickableTypes = useMemo(
    () => pieceTypePlans.filter((entry): entry is [string, PickablePlan] => entry[1].kind === "pickable"),
    [pieceTypePlans]
  );
  const infoTypes = useMemo(
    () => pieceTypePlans.filter(
      (entry): entry is [string, Exclude<PieceTypePlan, PickablePlan>] => entry[1].kind !== "pickable"
    ),
    [pieceTypePlans]
  );

  const [activeType, setActiveType] = useState(() => pickableTypes[0]?.[0] ?? "");

  const readyByType = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const [pieceType, plan] of pickableTypes) {
      result[pieceType] = playerSlots.every((slot) => {
        const count = (picksBySlot[slot.id]?.[pieceType] ?? []).length;
        return count >= plan.min && count <= plan.max;
      });
    }
    return result;
  }, [pickableTypes, picksBySlot, playerSlots]);

  const togglePick = (slotId: string, pieceType: string, pieceId: string) => {
    setPicksBySlot((prev) => {
      const slotPicks = prev[slotId] ?? {};
      const current = slotPicks[pieceType] ?? [];
      const plan = pickableTypes.find(([t]) => t === pieceType)?.[1];
      let next: Array<string>;
      if (current.includes(pieceId)) {
        next = current.filter((id) => id !== pieceId);
      } else if (plan && current.length >= plan.max) {
        next = current;
      } else {
        next = [...current, pieceId];
      }
      return { ...prev, [slotId]: { ...slotPicks, [pieceType]: next } };
    });
  };

  const reorderPick = (slotId: string, pieceType: string, fromIndex: number, toIndex: number) => {
    setPicksBySlot((prev) => {
      const slotPicks = prev[slotId] ?? {};
      const current = slotPicks[pieceType] ?? [];
      if (toIndex < 0 || toIndex >= current.length) return prev;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, [slotId]: { ...slotPicks, [pieceType]: next } };
    });
  };

  const allValid = pickableTypes.every(([pieceType]) => readyByType[pieceType]);
  const pendingTypes = pickableTypes.filter(([pieceType]) => !readyByType[pieceType]).map(([pieceType]) => pieceType);
  const activePlan = pickableTypes.find(([t]) => t === activeType)?.[1];

  const handleConfirm = () => {
    const result: Record<number, UserSelection> = {};
    playerSlots.forEach((slot, index) => {
      result[index] = buildUserSelection(rosterConfig, picksBySlot[slot.id] ?? {});
    });
    onConfirm(result);
  };

  return (
    <div className="selection-board">
      {infoTypes.length > 0 && (
        <div className="selection-board-info">
          {infoTypes.map(([pieceType, plan]) => (
            <span key={pieceType} className="piece-type-info-chip">
              {pieceType}: {plan.kind === "auto"
                ? (plan.reason === "mandatory" ? "included automatically" : plan.reason)
                : `${plan.configType} (not user-selectable)`}
            </span>
          ))}
        </div>
      )}

      <PieceTypeTabs
        types={pickableTypes.map(([pieceType]) => pieceType)}
        activeType={activeType}
        readyByType={readyByType}
        onSelect={setActiveType}
      />

      {activePlan && (
        <div className="selection-board-panels">
          {playerSlots.map((slot) => (
            <PlayerSelectionPanel
              key={slot.id}
              rosterConfig={rosterConfig}
              slot={slot}
              pieceType={activeType}
              plan={activePlan}
              picks={picksBySlot[slot.id]?.[activeType] ?? []}
              onTogglePick={(pieceId) => togglePick(slot.id, activeType, pieceId)}
              onReorderPick={(fromIndex, toIndex) => reorderPick(slot.id, activeType, fromIndex, toIndex)}
              pluginName={pluginName}
              matchAgentUrl={matchAgentUrl}
              matchAgentAuth={matchAgentAuth}
            />
          ))}
        </div>
      )}

      <div className="selection-board-footer">
        {!allValid && (
          <span className="selection-board-hint">Still needs: {pendingTypes.join(", ")}</span>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" disabled={!allValid} onClick={handleConfirm}>
          Confirm Selection
        </button>
      </div>
    </div>
  );
}
