
import { useUser } from "../../globals/user";
import { Route, Outlet, Navigate } from "react-router-dom";
import { relative } from "../../utils/fetch";
import { Login } from "./login";
import { Self } from "./self";

import { AuthPaths } from "./paths";

export const AuthRoute = <Route path={relative("/", AuthPaths.root)} element={<Outlet />} >
  <Route index element={<RedirectAuth />} />
  <Route path={relative(AuthPaths.root, AuthPaths.login)} element={<Login />} />
  <Route path={relative(AuthPaths.root, AuthPaths.self)} element={<Self />} />
</Route>;

function RedirectAuth() {
  const { user } = useUser();
  if(!user) return <Navigate to={AuthPaths.login} replace />;
  return <Navigate to={AuthPaths.self} replace />;
}
