import { Link } from "react-router-dom";
import { AuthPaths } from "../auth/paths";

export function Forbidden() {
  return (
    <div>
      <div>Forbidden</div>
      <p>You do not have permission to access this page.</p>
      <p><Link to={AuthPaths.login}>Login</Link> to request access.</p>
    </div>
  );
}

