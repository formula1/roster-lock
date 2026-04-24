import { InputProps } from "../../../../../../../utils/react";
import { PieceValue } from "../../types";

import { ToolTipSpan } from "../../../../../../../components/ToolTip";


import humanInfoTT from "./humanInfoTT.md";
import { ValidatingTextInput } from "../../../../../../../components/inputs/ValidatingTextInput";
import { validateFriendlyString, validateURL } from "@roster-lock/shared";

export function HumanInfo({ value, onChange }: (
  & InputProps<PieceValue["humanInfo"]>
)){

  return (
    <div className="section">
      <div><ToolTipSpan tip={humanInfoTT}>Human Info</ToolTipSpan></div>
      <div>
        <label>Name: </label>
        <ValidatingTextInput
          value={value.name}
          onChange={v => onChange({ ...value, name: v })}
          validate={validateFriendlyString}
        />
      </div>
      <div>
        <label>Author: </label>
        <ValidatingTextInput
          value={value.author}
          onChange={v => onChange({ ...value, author: v })}
          validate={validateFriendlyString}
        />
      </div>
      <div>
        <label>URL: </label>
        <ValidatingTextInput
          value={value.url}
          onChange={v => onChange({ ...value, url: v })}
          validate={validateURL}
        />
      </div>
    </div>
  )
}
