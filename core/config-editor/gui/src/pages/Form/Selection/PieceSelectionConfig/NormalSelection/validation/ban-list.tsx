import { useState } from "react";
import type { InputProps } from "../../../../../../utils/react/input";
import { ToolTipSpan } from "../../../../../../components/ToolTip";

export function BanListInput({ value, onChange }: InputProps<Array<string>>) {
  const [newId, setNewId] = useState("");

  function add() {
    const id = newId.trim();
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
    setNewId("");
  }

  return (
    <div className="section">
      <h4><ToolTipSpan tip={tt}>Ban List</ToolTipSpan></h4>
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

const tt = `Add pieces to the ban list if you want to reuse the roster but want to prevent certain pieces from being used`;