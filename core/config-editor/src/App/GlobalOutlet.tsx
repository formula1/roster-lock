
import { Outlet, useNavigate } from "react-router";
import { LinkTabs, Page } from "../components/Tabs";
import { useState } from "react";
import { GlobalLinksContext, useGlobalLinks } from "../globals/global-links";

export function GlobalOutlet(){
  const globalLinks = useState<Array<Page>>([])
  return (
    <GlobalLinksContext.Provider value={globalLinks} >
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <GlobalLinks />
    <Outlet />
    </div>
    </GlobalLinksContext.Provider>
  )
}

function GlobalLinks(){
  const navigate = useNavigate();
  const [buttons] = useGlobalLinks();
  return (
    <LinkTabs
      className="primary"
      pages={[
        { title: "◀️", onClick: ()=>(navigate(-1)) },
        { title: "▶️", onClick: ()=>(navigate(1)) },
        { title: 'Home', href: '/' },
        { title: 'About', href: '/about' },
        ...buttons
      ]}
    />
  )
}
