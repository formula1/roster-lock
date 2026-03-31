
import { Route, Outlet } from "react-router-dom";
import { relative } from "../../utils/fetch";
export * from "./paths";
import { MatchMakerPaths } from "./paths";

import { MatchMakers } from "./root";
import { MatchMakerItem } from "./item";

export const MatchMakerRoute = <Route path={relative("/", MatchMakerPaths.root)} element={<Outlet />} >
  <Route index element={<MatchMakers />} />
  <Route path={relative(MatchMakerPaths.root, MatchMakerPaths.item)} element={<MatchMakerItem />} />
</Route>;
