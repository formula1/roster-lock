import { useState } from "react";
import { InputProps } from "../../../../../../utils/react";
import { PieceValue } from "../../types";

import { ToolTipSpan } from "../../../../../../components/ToolTip";


import humanInfoTT from "./humanInfoTT.md";
import { ValidatingTextInput } from "../../../../../../components/inputs/ValidatingTextInput";
import { validateFriendlyString, validateURL, validateImageDataURI, IMAGE_DATA_URI_MAX_BYTES } from "@roster-lock/shared";

export function HumanInfo({ value, onChange }: (
  & InputProps<PieceValue["humanInfo"]>
)){
  const [imageError, setImageError] = useState<string | null>(null);

  async function onImageFileChosen(file: File){
    try {
      setImageError(null);
      const dataURI = await readFileAsDataURL(file);
      validateImageDataURI(dataURI);
      onChange({ ...value, image: dataURI });
    }catch(e){
      setImageError((e as Error).message);
    }
  }

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
      <div>
        <label>Image: </label>
        {value.image && <img src={value.image} alt="" style={{ height: 32, verticalAlign: "middle", marginRight: 8 }} />}
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if(file) onImageFileChosen(file);
          }}
        />
        {value.image && (
          <button type="button" onClick={() => onChange({ ...value, image: undefined })}>Remove</button>
        )}
        {imageError && <ToolTipSpan tip={imageError} style={{ color: "#F00" }}>⚠</ToolTipSpan>}
        <div style={{ fontSize: "0.8em", opacity: 0.7 }}>
          Embedded directly in the lock file, max {Math.floor(IMAGE_DATA_URI_MAX_BYTES / 1024)}KB.
        </div>
      </div>
    </div>
  )
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
