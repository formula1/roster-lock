import { Link } from "react-router-dom";

export function NavBar() {
  return (
    <nav className="nav-bar">
      <Link to="/connect">Connect</Link>
      <Link to="/join-settings">Join Settings</Link>
      <Link to="/game-launcher">Game Runners</Link>
      <Link to="/match-making">Match Making</Link>
      <Link to="/game">Games</Link>
    </nav>
  );
}
