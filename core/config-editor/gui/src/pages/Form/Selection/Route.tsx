import { Route, Outlet } from "react-router";
import { SelectionOutlet } from "./SelectionOutlet";

import { RosterLockPaths } from "../../paths";
import { relative } from "../../../utils/router";
import { SelectionOverviewPage } from "./Overview";
import { PieceSelectionConfigPage } from "./PieceSelectionConfig";
import { ScriptDictionaryRoute } from "./ScriptDictionary";
import { GlobalValidationPage } from "./GlobalValidation";

export const SelectionRoute = (
  <Route path={RosterLockPaths.Selection.INDEX.slice(1)} element={<SelectionOutlet />} >
    <Route index element={<SelectionOverviewPage />} />
    <Route
      path={relative(RosterLockPaths.Selection.INDEX, RosterLockPaths.Selection.GlobalValidation)}
      element={<GlobalValidationPage />}
    />
    <Route
      path={relative(RosterLockPaths.Selection.INDEX, RosterLockPaths.Selection.PieceSelection)}
      element={<PieceSelectionConfigPage />}
    />
    {ScriptDictionaryRoute}
  </Route>
);
