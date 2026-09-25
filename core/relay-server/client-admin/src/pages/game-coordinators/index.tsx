
import { Route, Outlet } from "react-router-dom";
import { relative } from "../../utils/fetch";
export * from "./paths";
import { GameCoordinatorPaths } from "./paths";

import { GameCoordinators } from "./root";
import { GameCoordinatorItem } from "./item";

export const GameCoordinatorRoute = <Route path={relative("/", GameCoordinatorPaths.root)} element={<Outlet />} >
  <Route index element={<GameCoordinators />} />
  <Route path={relative(GameCoordinatorPaths.root, GameCoordinatorPaths.item)} element={<GameCoordinatorItem />} />
</Route>;
