
import { Outlet } from "react-router";
import { LinkTabs } from "../components/Tabs";
import { NewRosterConfigPaths  } from "../pages/config-editor";
import { startsWith as pathStartsWith } from "../utils/router";

export function GlobalOutlet(){
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <LinkTabs
      className="primary"
      pages={[
        { title: 'Home', href: '/' },
        { title: 'About', href: '/about' },
        {
          title: "New Config",
          href: NewRosterConfigPaths.Root,
          isActive: (location) => pathStartsWith(location.pathname, NewRosterConfigPaths.Root),
        }
      ]}
    />
    <Outlet />
    </div>
  )
}
