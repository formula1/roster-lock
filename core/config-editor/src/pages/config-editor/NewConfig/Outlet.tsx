
import { Outlet } from "react-router";
import { NewConfigProvider } from "./data/Config";
import { LinkTabs } from "../../../components/Tabs";
import { useNewConfig } from "./data/Config";

import { NewRosterConfigPaths } from "./paths";
import { replaceParams } from "../../../utils/router";
import { useSaveFile } from "./data/saveFile";
import { FollowButtonsProvider } from "../Form/Contexts/Buttons";
import { ContextFromDraftProvider } from "../Contexts/ContextFromDraft";
import { confirm } from '@tauri-apps/plugin-dialog';

export function NewConfigOutlet(){
  return <NewConfigProvider>
    <ConfigTabs />
    <OutletWithContext />
  </NewConfigProvider>
}

function ConfigTabs(){
  const { value, reset } = useNewConfig();
  const saveFile = useSaveFile();
  return (
    <LinkTabs
      className="secondary"
      pages={[
        { title: 'Recent Files', href: "/" },
        { title: "New", onClick: async () =>{
          if(!await confirm("Are you sure you want to reset?\nYou will lose all changes.")) return;
          reset()
        } },
        { title: "Save", onClick: () => saveFile() },
        {
          title: "Overview", href: NewRosterConfigPaths.Root
        },
        {
          title: 'Engine', href: NewRosterConfigPaths.Engine
        },
        {
          title: 'Rosters', href: NewRosterConfigPaths.Roster
        },
        {
          title: 'Selection', href: NewRosterConfigPaths.Selection,
        },
      ]}
    />
  )
}

function OutletWithContext(){
  const config = useNewConfig();
  const saveFile = useSaveFile();
  return (
  <FollowButtonsProvider
    buttons={[
      {
        label: "Save",
        onClick: saveFile,
      }
    ]}
  >
  <ContextFromDraftProvider
    value={config.value}
    onChange={config.onChange}
  >
    <Outlet />
  </ContextFromDraftProvider>
  </FollowButtonsProvider>
  );
}