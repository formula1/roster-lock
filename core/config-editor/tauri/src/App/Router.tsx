import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router";
import { FileConfigEditorRoute } from "@roster-lock/config-editor-gui";

import { GlobalOutlet } from "./GlobalOutlet";
import { HomePage } from "../pages/Home";
import { AboutPage } from "../pages/About";
import { NotFoundPage } from "../pages/Util/NotFound";

export function Router(){
  return <BrowserRouter>
    <Routes>
      <Route path="/" element={<GlobalOutlet />} >
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        {FileConfigEditorRoute("config")}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
}
