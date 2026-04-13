
import { Outlet } from "react-router";
import { NewConfigProvider } from "./data/Config";
import { LinkTabs } from "../../../components/Tabs";
import { useNewConfig } from "./data/Config";

import { RosterLockConfigPaths as ConfigPaths } from "../paths";
import { replaceParams } from "../../../utils/router";
import { useSaveFile } from "./data/saveFile";
import { DraftInfoProvider } from "../Contexts/DraftInfo";

export function NewConfigOutlet(){
  return <NewConfigProvider>
    <ConfigTabs />
    <OutletWithContext />
  </NewConfigProvider>
}

function ConfigTabs(){
  const { value } = useNewConfig();
  const saveFile = useSaveFile();
  return (
    <LinkTabs
      className="secondary"
      pages={[
        { title: 'Recent Files', href: "/" },
        { title: 'New', href: ConfigPaths.newRoot },
        { title: "Save", onClick: () => saveFile() },
        {
          title: 'Engine', href: replaceParams(
            ConfigPaths.newEngine, {}
          ),
        },
        {
          title: 'Rosters', href: replaceParams(
            ConfigPaths.newRoster, {}
          ),
        },
        {
          title: 'Selection', href: replaceParams(
            ConfigPaths.newSelection, {}
          ),
        },
      ]}
    />
  )
}

function OutletWithContext(){
  const config = useNewConfig();
  return <DraftInfoProvider draft={config.value} >
    <Outlet />
  </DraftInfoProvider>
}