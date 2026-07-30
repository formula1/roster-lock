import { Route } from "react-router";

import { FileConfigOutlet } from "./Outlet";

import { RosterLockPaths } from "./paths";

import { ConfigRoot } from "./Form/ConfigRoot"
import { EngineEditPage } from "./Form/Engine";
import { EngineTest } from "./Form/EngineTest";
import { RosterConfigEditPage } from "./Form/Rosters";
import { SelectionRoute } from "./Form/Selection";


export function  FileConfigEditorRoute(prefix: string){
  if(prefix.endsWith("/")){
    prefix = prefix.slice(0, -1)
  }
  return (
    <Route path={prefix + RosterLockPaths.Root} element={<FileConfigOutlet />}>
      <Route index element={<ConfigRoot />} />
      <Route path={RosterLockPaths.Engine.slice(1)} element={<EngineEditPage />} />
      <Route path={RosterLockPaths.EngineTest.slice(1)} element={<EngineTest />} />
      <Route path={RosterLockPaths.Roster.slice(1)} element={<RosterConfigEditPage />} />
      {SelectionRoute}
    </Route>
  )
}