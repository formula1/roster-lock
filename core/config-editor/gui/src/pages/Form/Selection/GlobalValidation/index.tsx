import type { UntrustedScriptRef } from "@roster-lock/types";
import type { InputProps } from "../../../../utils/react/input";
import { ScriptRefArrayInput } from "../ScriptRef"
import { useRosterLock } from "../../Contexts/RosterLock";

type Props = InputProps<Array<UntrustedScriptRef>>;

export function GlobalValidationPage(){
  const { value, onChange } = useRosterLock();

  return (
    <GlobalValidation
      value={value.selection.globalValidation}
      onChange={scripts =>
        onChange(old => ({
          ...old,
          selection: {
            ...old.selection,
            globalValidation: scripts,
          },
        }))
      }
    />
  );

}

export function GlobalValidation({ value, onChange }: Props) {
  return (
    <div className="section">
      <h2>Global Validation</h2>
      <p style={{ opacity: 0.7, margin: "0 0 0.5rem" }}>
        Scripts run after all piece selections are merged. Receives the complete final selection.
      </p>

      <ScriptRefArrayInput
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
