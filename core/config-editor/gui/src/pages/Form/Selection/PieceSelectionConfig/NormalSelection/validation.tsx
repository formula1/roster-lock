import { useState } from "react";
import type { UserSelectionValidation } from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";
import { CountUnknownInput } from "../../../components/CountUnknown/Input";
import { UniqueSelectionInput } from "./validation/unique";
import { ScriptRefArrayInput } from "../../ScriptRef";
import { BanListInput } from "./validation/ban-list";

type Count = UserSelectionValidation["count"];

type Props = InputProps<UserSelectionValidation> & {
  pieceType: string;
};

export function NormalValidation({ value, onChange, pieceType }: Props) {
  return (
    <>
      <div className="section">
        <CountUnknownInput
          value={value.count as Count}
          onChange={count => onChange({ ...value, count })}
        />
      </div>

      <UniqueSelectionInput
        value={value.unique}
        onChange={(unique)=>(onChange({ ...value, unique }))}
      />

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
          itemStyle={{
            borderRadius: "4px",
            border: `2px solid #50af50"`,
            backgroundColor: "#ddfadd",
            transition: "all 0.2s ease"
          }}
        />
      </div>
    </>
  );
}

