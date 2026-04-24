import { Route } from "react-router";
import { ConfigEditorRoute } from "./Form";

import {
  NewConfigOutlet,
} from "./NewConfig";
import {
  FileConfigOutlet,
} from "./FileConfig";
import { relative } from "../../utils/router";

import { NewRosterConfigPaths } from "./NewConfig";
import { FileRosterConfigPaths } from "./FileConfig";



export const NewConfigEditorRoute = (
  <Route path={relative("/", NewRosterConfigPaths.Root)} element={<NewConfigOutlet />}>
    {ConfigEditorRoute}
  </Route>
);

export const FileConfigEditorRoute = (
  <Route path={relative("/", FileRosterConfigPaths.Root)} element={<FileConfigOutlet />}>
    {ConfigEditorRoute}
  </Route>
)
