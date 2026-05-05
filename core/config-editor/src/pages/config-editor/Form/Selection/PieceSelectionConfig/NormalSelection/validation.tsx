import { useState } from "react";
import type { UserSelectionValidation } from "@roster-lock/types";
import type { InputProps } from "../../../../../../utils/react/input";
import { CountUnknownInput } from "../../../Engine/PieceDefinitions/AssetDefinition/CountUnknown/Input";
import { ScriptRefArrayInput } from "../../ScriptRef";

type Count = UserSelectionValidation["count"];

type Props = InputProps<UserSelectionValidation> & {
  pieceType: string;
};

export function NormalValidation({ value, onChange, pieceType }: Props) {
  return (
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
        <ScriptRefArrayInput
          value={value.customValidation}
          onChange={(customValidation)=>{
            onChange({ ...value, customValidation })
          }}
        />
      </div>
    </>
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
