import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router";

import { GlobalOutlet } from "./GlobalOutlet";
import { HomePage } from "../pages/Home";
import { AboutPage } from "../pages/About";
import {
  FileConfigEditorRoute,
} from "../pages/config-editor";
import { NotFoundPage } from "../pages/Util/NotFound";

export function Router(){
  return <BrowserRouter>
    <Routes>
      <Route path="/" element={<GlobalOutlet />} >
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        {FileConfigEditorRoute}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
}
