import type {
  RosterLockPiece,
  SelectionNormalConfig,
  SelectionGameControlledConfig,
  SelectionPreselectedConfig,
  SelectionPieceMeta,
  JSONShallowObject,
  GasLimittedScript,
  EngineSelectionStrategy,
} from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { PieceMetaEditor } from "../PieceMetaEditor";
import { NormalValidation } from "../NormalValidation";
import { ScriptInput } from "../ScriptInput";

type AnySelectionConfig =
  | SelectionNormalConfig
  | SelectionGameControlledConfig
  | SelectionPreselectedConfig;

type Props = InputProps<AnySelectionConfig | undefined> & {
  pieceType: string;
  strategy: EngineSelectionStrategy;
  pieces: Array<RosterLockPiece>;
};

function toNormal(v: AnySelectionConfig | undefined): SelectionNormalConfig {
  if (v?.type === "normal") return v;
  return { type: "normal", pieceMeta: (v as any)?.pieceMeta };
}

function toGameControlled(v: AnySelectionConfig | undefined): SelectionGameControlledConfig {
  if (v?.type === "game-controlled") return v;
  return { type: "game-controlled", pieceMeta: (v as any)?.pieceMeta };
}

function strategyLabel(strategy: EngineSelectionStrategy): string {
  return { mandatory: "Mandatory", personal: "Personal", shared: "Shared", "on demand": "On Demand" }[strategy] ?? strategy;
}

export function PieceSelectionConfig({ pieceType, strategy, pieces, value, onChange }: Props) {
  const isNormal = strategy === "personal" || strategy === "shared";

  const config_ = isNormal ? toNormal(value) : toGameControlled(value);
  const pieceMeta = config_.pieceMeta;

  function setPieceMeta(pm: SelectionPieceMeta<JSONShallowObject> | undefined) {
    onChange({ ...config_, pieceMeta: pm } as AnySelectionConfig);
  }

  return (
    <div className="section">
      <h2>
        {pieceType}
        <span style={{
          marginLeft: "0.75rem",
          fontSize: "0.75em",
          fontWeight: "normal",
          opacity: 0.7,
        }}>
          {strategyLabel(strategy)}
        </span>
      </h2>

      <PieceMetaEditor
        value={pieceMeta}
        onChange={setPieceMeta}
        pieces={pieces}
      />

      {isNormal && (() => {
        const normal = config_ as SelectionNormalConfig;
        return (
          <>
            <NormalValidation
              value={normal.validation}
              onChange={validation => onChange({ ...normal, validation })}
              pieceType={pieceType}
            />

            {strategy === "shared" && (
              <ScriptInput
                label="Merge Algorithm"
                value={normal.mergeAlgorithm}
                onChange={script => onChange({ ...normal, mergeAlgorithm: script as GasLimittedScript })}
                onRemove={normal.mergeAlgorithm ? () => onChange({ ...normal, mergeAlgorithm: undefined }) : undefined}
                purpose="piece-merge"
                pieceType={pieceType}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
