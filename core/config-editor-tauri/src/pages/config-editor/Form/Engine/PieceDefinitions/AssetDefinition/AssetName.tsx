import type { RosterLockEngineConfig } from "@roster-lock/types";
import { ListItemProps, type InputProps } from "../../../../../../utils/react";

type AssetDefinition = RosterLockEngineConfig["pieceDefinitions"][string]["assets"][number];

import { TitleInput } from "../../../../../../components/TitleInput";

export function AssetNameInput({ value, onChange, onDelete, items }: (
  & InputProps<string>
  & ListItemProps<AssetDefinition>
)){

  return <TitleInput
    placeholder="Asset Name..."
    originalValue={value}
    validate={(name) => {
      if(items.find((a) => a.name === name)) throw new Error("Name already exists");
    }}
    onSubmit={onChange}
    onDelete={onDelete}
  />
}
