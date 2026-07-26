import { ToolTipSpan } from "../../../../../../components/ToolTip";
import { InputProps } from "../../../../../../utils/react";

export function UniqueSelectionInput(
  { value, onChange }: InputProps<boolean>
){
  return (
    <div className="section">
      <h4><ToolTipSpan tip={tt}>Ensure Unique</ToolTipSpan></h4>
      <label>
        <input
          type="checkbox"
          checked={value}
          onChange={e => onChange(!value)}
        />
        <span style={{ marginLeft: "5px" }}>
        {value ? "Selected pieces will be expected to be unique" :
        "Can select the same piece multiple times"}
        </span>
      </label>
    </div>
  );
}

const tt = `When toggled, the list will be validated to make sure it's unique.

This means no two of the same piece can be used.

Toggling will not validate if different users can use the same piece.
`
