import { Route, Outlet } from "react-router";

import { FileConfigOutlet } from "./Outlet";
import { relative } from "../../utils/router";

import { RosterLockPaths } from "./paths";

import { ConfigRoot } from "./Form/ConfigRoot"
import { EngineEditPage } from "./Form/Engine";
import { EngineTest } from "./Form/EngineTest";
import { RosterConfigEditPage } from "./Form/Rosters";
import { SelectionEditPage } from "./Form/Selection";
import { ScriptDictionaryRoute } from "./Form/Selection/ScriptDictionary";


export const FileConfigEditorRoute = (
  <Route path={relative("/", RosterLockPaths.Root)} element={<FileConfigOutlet />}>
    <Route index element={<ConfigRoot />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.Engine)} element={<EngineEditPage />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.EngineTest)} element={<EngineTest />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.Roster)} element={<RosterConfigEditPage />} />
    <Route path={relative(RosterLockPaths.Root, RosterLockPaths.Selection.INDEX)} element={<Outlet />} >
      <Route index element={<SelectionEditPage />} />
      <Route
        path={relative(
          RosterLockPaths.Selection.INDEX,
          RosterLockPaths.Selection.ScriptDictionary.INDEX
        )}
        element={<Outlet />}
      >
        {ScriptDictionaryRoute}
      </Route>
    </Route>
  </Route>
)
