import { Route } from "react-router";

import { FileConfigOutlet } from "./Outlet";
import { relative } from "../../utils/router";

import { RosterLockPaths } from "./paths";

import { ConfigRoot } from "./Form/ConfigRoot"
import { EngineEditPage } from "./Form/Engine";
import { EngineTest } from "./Form/EngineTest";
import { RosterConfigEditPage } from "./Form/Rosters";
import { SelectionRoute } from "./Form/Selection";


export const FileConfigEditorRoute = (
  <Route path={relative("/", RosterLockPaths.Root)} element={<FileConfigOutlet />}>
    <Route index element={<ConfigRoot />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.Engine)} element={<EngineEditPage />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.EngineTest)} element={<EngineTest />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.Roster)} element={<RosterConfigEditPage />} />
    {SelectionRoute}
  </Route>
)
