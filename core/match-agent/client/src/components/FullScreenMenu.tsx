import { RefObject } from "react";
import { NavLink } from "react-router-dom";
import { NAV_LINKS } from "../NavBar";
import { useGlobalNav } from "../context/GlobalNavContext";
import { backHint } from "../utils/inputLabels";

// Opened by Space / a gamepad's Start button - see GlobalNavContext. Lets
// either device reach NavBar's links in one press rather than
// roving-focusing all the way up to them from wherever the page scrolled.
export function FullScreenMenu({ containerRef, open, onClose }: {
  containerRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  onClose: () => void,
}) {
  const { inputDevice, keyboardBindings, gamepadBindings } = useGlobalNav();
  if (!open) return null;

  return (
    <div className="fullscreen-menu-backdrop" onClick={onClose}>
      <div className="fullscreen-menu" ref={containerRef} onClick={(e) => e.stopPropagation()}>
        {NAV_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} className="fullscreen-menu-link" onClick={onClose}>
            {link.label}
          </NavLink>
        ))}
        <button type="button" className="fullscreen-menu-close" onClick={onClose}>
          Close ({backHint(inputDevice, keyboardBindings, gamepadBindings)})
        </button>
      </div>
    </div>
  );
}
