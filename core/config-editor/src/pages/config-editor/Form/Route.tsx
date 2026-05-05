import { Outlet, Route } from "react-router";
import { RosterLockPaths } from "./paths";

import { ConfigRoot } from "./ConfigRoot"
import { EngineEditPage } from "./Engine";
import { EngineTest } from "./EngineTest";
import { RosterConfigEditPage } from "./Rosters";
import { relative } from "../../../utils/router";

import { SelectionEditPage } from "./Selection";
import { ScriptDictionaryRoute } from "./Selection/ScriptDictionary";


export const ConfigEditorRoute = (
  <>
    <Route index element={<ConfigRoot />} />
    <Route path={relative("/", RosterLockPaths.Engine)} element={<EngineEditPage />} />
    <Route path={relative("/", RosterLockPaths.EngineTest)} element={<EngineTest />} />
    <Route path={relative("/", RosterLockPaths.Roster)} element={<RosterConfigEditPage />} />
    <Route path={relative("/", RosterLockPaths.Selection.INDEX)} element={<Outlet />} >
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
  </>
)
