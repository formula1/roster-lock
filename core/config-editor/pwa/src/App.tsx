import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { Routes, Route, Outlet, useNavigate } from "react-router";
import {
  RouterWrapper, FileConfigEditorRoute, GlobalLinksContext, useGlobalLinks,
  LinkTabs, type Page,
} from "@roster-lock/config-editor-gui";

import { createPwaHost } from "./host";
import { HomePage } from "./pages/Home";

// The agent connection (and with it, plugin-backed features) lives inside
// RouterWrapper now - the host itself is static.
const HOST = createPwaHost();

export function App(){
  return (
    <BrowserRouter>
      <RouterWrapper host={HOST}>
        <Routes>
          <Route path="/" element={<GlobalShell />}>
            <Route index element={<HomePage />} />
            {FileConfigEditorRoute("config")}
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouterWrapper>
    </BrowserRouter>
  );
}

function GlobalShell(){
  const globalLinks = useState<Array<Page>>([]);
  return (
    <GlobalLinksContext.Provider value={globalLinks}>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <GlobalLinks />
        <div style={{ flexGrow: 1, overflow: "auto" }}>
          <Outlet />
        </div>
      </div>
    </GlobalLinksContext.Provider>
  );
}

function GlobalLinks(){
  const navigate = useNavigate();
  const [links] = useGlobalLinks();
  return (
    <LinkTabs
      className="primary"
      pages={[
        { title: "◀️", onClick: ()=>(navigate(-1)) },
        { title: "▶️", onClick: ()=>(navigate(1)) },
        { title: "Home", href: "/" },
        ...links,
      ]}
    />
  );
}

function NotFoundPage(){
  return (
    <div style={{ padding: "20px" }}>
      <h1>Not Found</h1>
      <a href="/">Back home</a>
    </div>
  );
}
