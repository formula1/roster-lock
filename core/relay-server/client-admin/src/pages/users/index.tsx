
import { Route, Outlet } from "react-router-dom";
import { relative } from "../../utils/fetch";
export * from "./paths";
import { UsersPaths } from "./paths";

import { Users } from "./root";
import { UserItem } from "./item";

export const UsersRoute = <Route path={relative("/", UsersPaths.root)} element={<Outlet />} >
  <Route index element={<Users />} />
  <Route path={relative(UsersPaths.root, UsersPaths.item)} element={<UserItem />} />
</Route>;
