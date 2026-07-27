import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameSession } from "../../context/GameSessionContext";
import { planForPieceType, buildUserSelection, PieceTypePlan } from "../../game/selection";
import { PieceTypeSection } from "./PieceTypeSection";

export function SelectScreen() {
  const navigate = useNavigate();
  const { rosterConfig, setSelection } = useGameSession();
  const [picks, setPicks] = useState<Record<string, Array<string>>>({});

  const pieceTypes = useMemo(
    () => (rosterConfig ? Object.keys(rosterConfig.engine.pieceDefinitions) : []),
    [rosterConfig],
  );
  const plans = useMemo(
    () =>
      rosterConfig
        ? (Object.fromEntries(pieceTypes.map((t) => [t, planForPieceType(rosterConfig, t)])) as Record<
            string,
            PieceTypePlan
          >)
        : {},
    [rosterConfig, pieceTypes],
  );

  if (!rosterConfig) return null;

  const pickableTypes = pieceTypes.filter((t) => plans[t]!.kind === "pickable");
  const isValid = pickableTypes.every((t) => {
    const plan = plans[t] as Extract<PieceTypePlan, { kind: "pickable" }>;
    const count = (picks[t] ?? []).length;
    return count >= plan.min && count <= plan.max;
  });

  function handleConfirm() {
    const selection = buildUserSelection(rosterConfig!, picks);
    setSelection(selection);
    navigate("/matchmaking");
  }

  return (
    <div>
      <h1>Choose Your Pieces</h1>
      <p className="status">Click the pieces you want to bring into the match.</p>

      {pieceTypes.map((pieceType) => {
        const plan = plans[pieceType]!;
        if (plan.kind === "auto") {
          const label =
            plan.reason === "mandatory"
              ? "included automatically"
              : plan.reason === "on-demand"
                ? "chosen during play"
                : "not selectable";
          return (
            <div key={pieceType} className="info-row">
              {pieceType}: {label}
            </div>
          );
        }
        if (plan.kind === "unsupported") {
          return (
            <div key={pieceType} className="banner">
              {pieceType}: selection type "{plan.configType}" isn't supported yet.
            </div>
          );
        }
        return (
          <PieceTypeSection
            key={pieceType}
            rosterConfig={rosterConfig}
            pieceType={pieceType}
            plan={plan}
            selected={picks[pieceType] ?? []}
            onChange={(ids) => setPicks((prev) => ({ ...prev, [pieceType]: ids }))}
          />
        );
      })}

      <div className="actions">
        <button disabled={!isValid} onClick={handleConfirm}>
          Confirm Selection
        </button>
      </div>
    </div>
  );
}
