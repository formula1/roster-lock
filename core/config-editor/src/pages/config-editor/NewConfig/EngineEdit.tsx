
import { EngineConfigForm, EngineLegend } from "../Form";

import { FollowButtonForm } from "../../../components/FollowButtonForm";
import { useNewConfig } from "./data/Config";
import { useSaveFile } from "./data/saveFile";

export function NewEngineConfig(){
  const { value, onChange } = useNewConfig();
  const saveFile = useSaveFile();

  return <div style={{ overflow: "hidden", flexGrow: 1 }}>
    <h1>New Engine Config</h1>
    <FollowButtonForm
      info={{
        title: "New Engine Config",
        note: <EngineLegend config={value.stagedLock} />,
      }}
      buttons={[
        {
          label: "Save",
          onClick: saveFile,
        }
      ]}
    >
      <EngineConfigForm
        value={value.stagedLock}
        onChange={(stagedLock)=>(onChange((oldValue)=>({ ...oldValue, stagedLock })))}
      />
    </FollowButtonForm>
  </div>
}
