import type { GasLimittedScript } from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { ScriptInput } from "../ScriptInput";

type Props = InputProps<Array<GasLimittedScript>>;

export function GlobalValidation({ value, onChange }: Props) {
  function addScript() {
    onChange([...value, { type: "text/lua", src: "" }]);
  }

  function updateScript(i: number, script: GasLimittedScript | undefined) {
    if (!script) return;
    const next = [...value];
    next[i] = script;
    onChange(next);
  }

  function removeScript(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  return (
    <div className="section">
      <h2>Global Validation</h2>
      <p style={{ opacity: 0.7, margin: "0 0 0.5rem" }}>
        Scripts run after all piece selections are merged. Receives the complete final selection.
      </p>

      {value.map((script, i) => (
        <ScriptInput
          key={i}
          label={`Global Validation Script ${i + 1}`}
          value={script}
          onChange={s => updateScript(i, s as GasLimittedScript)}
          onRemove={() => removeScript(i)}
          purpose="global-validation"

        />
      ))}

      <button type="button" onClick={addScript}>
        Add Global Validation Script
      </button>
    </div>
  );
}
