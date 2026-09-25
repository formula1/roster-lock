import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div>
      <div>Not Found</div>
      <p>The page you are looking for does not exist.</p>
      <p><Link to="/">Go home</Link></p>
    </div>
  );
}
