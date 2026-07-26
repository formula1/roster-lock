import { Outlet } from "react-router";
import { useEffect, useMemo } from "react";
import { useConfig } from "../../globals/ConfigContext";
import { useGlobalLinks } from "../../globals/global-links";
import { RosterLockPaths } from "../paths";
import { ContextFromDraftProvider } from "../Contexts/ContextFromDraft";
import { useEnsureCorrectSelection } from "../Form/Selection/utils/ensure-correct-selection";
import { PageInfoProvider, usePageInfo } from "../Contexts/PageTitle";
import { FollowButtonForm } from "../../components/FollowButtonForm";

export function FileConfigOutlet(){
  useConfigTabs();

  return (
    <PageInfoProvider>
      <ConfigOutletBody />
    </PageInfoProvider>
  );
}

function useConfigTabs(){
  const [, setLinks] = useGlobalLinks();

  useEffect(()=>{
    setLinks([
      { title: "Overview", href: RosterLockPaths.Root },
      { title: 'Engine', href: RosterLockPaths.Engine },
      { title: 'Rosters', href: RosterLockPaths.Roster },
      { title: 'Selection', href: RosterLockPaths.Selection.INDEX },
    ]);
    return ()=>{
      setLinks([])
    }
  }, [])
}

function ConfigOutletBody(){
  const config = useConfig();
  const { value: pageInfo } = usePageInfo();

  const buttons = useMemo(()=>{
    if(config.state !== "ready") return [];
    return [
      {
        label: "Save",
        onClick: async ()=>{
          await config.save(config.draft);
        },
        disabled: !config.isDirty,
      },
      {
        label: "Save As...",
        onClick: async ()=>{
          await config.saveAs(config.draft);
        },
      },
      {
        label: "Reset Changes ",
        onClick: () => config.reset(),
        disabled: !config.isDirty,
      },
    ]
  }, [config])

  // Without a loaded config none of the editor pages can render - the host
  // owns opening/creating drafts, so just point the user back to it.
  if(config.state === "empty"){
    return (
      <div>
        <h1>No config loaded</h1>
        <p>Open or create a Roster Lock draft first.</p>
      </div>
    );
  }
  if(config.state === "error"){
    console.log("Failed to load config", config.error);
    return (
      <div>
        <h1>Failed to load file</h1>
        <h3><button onClick={config.reload}>Reload</button></h3>
        <pre>{(config.error as { message?: string })?.message || JSON.stringify(config.error, null, 2)}</pre>
      </div>
    );
  }
  return (
  <FollowButtonForm
    info={pageInfo}
    buttons={buttons}
  >
  <ContextFromDraftProvider
    value={config.draft}
    onChange={config.update}
  >
    <EnsuredOutlet />
  </ContextFromDraftProvider>
  </FollowButtonForm>
  );
}


function EnsuredOutlet(){
  useEnsureCorrectSelection();
  return <Outlet />;
}
