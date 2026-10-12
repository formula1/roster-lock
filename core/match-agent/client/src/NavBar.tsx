import { Link } from "react-router-dom";

// Shared with FullScreenMenu so a gamepad's Start-button menu (see
// GlobalNavContext) lists exactly the same destinations as this bar.
export const NAV_LINKS = [
  { to: "/match-making", label: "Match Making" },
  { to: "/game", label: "Games" },
  { to: "/join-settings", label: "Join Settings" },
  { to: "/game-launcher", label: "Game Launchers" },
  { to: "/preview-roster", label: "Preview Roster" },
  { to: "/controls", label: "Controls" },
  { to: "/connect", label: "Connect" },
];

export function NavBar() {
  return (
    <nav className="nav-bar">
      {NAV_LINKS.map((link) => (
        <Link key={link.to} to={link.to}>{link.label}</Link>
      ))}
    </nav>
  );
}
