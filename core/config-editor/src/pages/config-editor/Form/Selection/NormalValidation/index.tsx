import { useState } from "react";
import type { UserSelectionValidation, GasLimittedScript } from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { CountUnknownInput } from "../../Engine/PieceDefinitions/AssetDefinition/CountUnknown/Input";
import { ScriptInput } from "../ScriptInput";

type Count = UserSelectionValidation["count"];

const DEFAULT_VALIDATION: UserSelectionValidation = {
  count: 1,
  unique: true,
  banList: [],
  customValidation: [],
};

type Props = InputProps<UserSelectionValidation | undefined> & {
  pieceType: string;
};

export function NormalValidation({ value, onChange, pieceType }: Props) {
  const enabled = value !== undefined;

  function toggle() {
    onChange(enabled ? undefined : DEFAULT_VALIDATION);
  }

  return (
    <div className="section">
      <h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={enabled} onChange={toggle} />
          Selection Validation
        </label>
      </h3>

      {value && (
        <>
          <CountUnknownInput
            value={value.count as Count}
            onChange={count => onChange({ ...value, count })}
          />

          <div>
            <label>
              <input
                type="checkbox"
                checked={value.unique}
                onChange={e => onChange({ ...value, unique: e.target.checked })}
              />
              {" Unique selections only"}
            </label>
          </div>

          <BanListInput
            value={value.banList ?? []}
            onChange={banList => onChange({ ...value, banList })}
          />

          <div className="section">
            <h4>Custom Validation Scripts</h4>
            {value.customValidation.map((script, i) => (
              <ScriptInput
                key={i}
                label={`Validation Script ${i + 1}`}
                value={script}
                onChange={updated => {
                  const next = [...value.customValidation];
                  next[i] = updated as GasLimittedScript;
                  onChange({ ...value, customValidation: next });
                }}
                onRemove={() => {
                  const next = [...value.customValidation];
                  next.splice(i, 1);
                  onChange({ ...value, customValidation: next });
                }}
                purpose="piece-user-validation"
                pieceType={pieceType}
              />
            ))}
            <button
              type="button"
              onClick={() => onChange({
                ...value,
                customValidation: [...value.customValidation, { type: "text/lua", src: "" }],
              })}
            >
              Add Validation Script
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BanListInput({ value, onChange }: InputProps<Array<string>>) {
  const [newId, setNewId] = useState("");

  function add() {
    const id = newId.trim();
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
    setNewId("");
  }

  return (
    <div className="section">
      <h4>Ban List</h4>
      {value.length > 0 && (
        <ul>
          {value.map((id, i) => (
            <li key={id} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontFamily: "monospace" }}>{id}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={e => { e.preventDefault(); add(); }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          type="text"
          placeholder="Piece ID to ban..."
          value={newId}
          onChange={e => setNewId(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
