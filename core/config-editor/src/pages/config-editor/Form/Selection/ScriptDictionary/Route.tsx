
import { relative } from "../../../../../utils/router";
import { RosterLockPaths } from "../../../paths";
import { Route, Outlet } from "react-router";
import { CurrentFilesPage } from "./pages/CurrentFiles";
import { MergeFolderPage } from "./pages/MergeFolder";
import { ScriptDictionaryIndexPage } from "./pages/IndexPage";
import { RunScriptPage } from "./pages/RunScript";

export const ScriptDictionaryRoute = (
  <Route
    path={relative(
      RosterLockPaths.Selection.INDEX,
      RosterLockPaths.Selection.ScriptDictionary.INDEX
    )}
    element={<Outlet />}
  >
    <Route index element={<ScriptDictionaryIndexPage />} />
    <Route
      path={relative(
        RosterLockPaths.Selection.ScriptDictionary.INDEX,
        RosterLockPaths.Selection.ScriptDictionary.CurrentFiles
      )}
      element={<CurrentFilesPage />}
    />
    <Route
      path={relative(
        RosterLockPaths.Selection.ScriptDictionary.INDEX,
        RosterLockPaths.Selection.ScriptDictionary.MergeFolder
      )}
      element={<MergeFolderPage />}
    />
    <Route
      path={relative(
        RosterLockPaths.Selection.ScriptDictionary.INDEX,
        RosterLockPaths.Selection.ScriptDictionary.RunScript
      )}
      element={<RunScriptPage />}
    />
  </Route>
)

