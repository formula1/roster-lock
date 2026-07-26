import { RosterLockPaths } from "@roster-lock/config-editor-gui";
import { replaceParams } from "../../utils/router";

export type AssistantPage = {
  id: string,
  path: string,
  title: string,
  description: string,
  // param names this page's path needs beyond ":filePath" (e.g. ["pieceType"])
  params: Array<string>,
};

export const ASSISTANT_PAGES: Array<AssistantPage> = [
  {
    id: "home", path: "/", title: "Home",
    description: "Recent files, and starting or opening a draft.",
    params: [],
  },
  {
    id: "about", path: "/about", title: "About",
    description: "About this app.",
    params: [],
  },
  {
    id: "config-root", path: RosterLockPaths.Root, title: "Draft overview",
    description: "The open draft's title, author, and version info, plus top-level actions (promote/publish).",
    params: [],
  },
  {
    id: "engine", path: RosterLockPaths.Engine, title: "Engine",
    description: "Define piece types: selection strategy, required other piece types, path variables, and asset definitions (globs, classification, counts).",
    params: [],
  },
  {
    id: "engine-test", path: RosterLockPaths.EngineTest, title: "Engine test",
    description: "Test a piece type's asset definitions against a real folder to see what matches or is missing, before adding real pieces.",
    params: [],
  },
  {
    id: "roster", path: RosterLockPaths.Roster, title: "Roster",
    description: "The actual pieces (content) for each piece type: human info (name/author/url/image), download sources, path variables, required pieces.",
    params: [],
  },
  {
    id: "selection", path: RosterLockPaths.Selection.INDEX, title: "Selection overview",
    description: "Per-piece-type selection config: normal, preselected, unselectable, or game-controlled.",
    params: [],
  },
  {
    id: "selection-global-validation", path: RosterLockPaths.Selection.GlobalValidation, title: "Global validation",
    description: "Validation rules that span multiple piece types together.",
    params: [],
  },
  {
    id: "selection-piece", path: RosterLockPaths.Selection.PieceSelection, title: "Piece selection config",
    description: "Selection config for one specific piece type. Needs a pieceType param.",
    params: ["pieceType"],
  },
  {
    id: "selection-scripts", path: RosterLockPaths.Selection.ScriptDictionary.INDEX, title: "Selection scripts",
    description: "Scripts used for custom selection validation/merging logic.",
    params: [],
  },
  {
    id: "selection-scripts-docs", path: RosterLockPaths.Selection.ScriptDictionary.Docs, title: "Script docs",
    description: "Generated type docs (.d.ts) for writing selection scripts.",
    params: [],
  },
  {
    id: "selection-scripts-add", path: RosterLockPaths.Selection.ScriptDictionary.AddScripts, title: "Add scripts",
    description: "Add new selection scripts to the draft.",
    params: [],
  },
  {
    id: "selection-scripts-available", path: RosterLockPaths.Selection.ScriptDictionary.AvailableScripts, title: "Available scripts",
    description: "Browse scripts already added to the draft.",
    params: [],
  },
  {
    id: "selection-scripts-run", path: RosterLockPaths.Selection.ScriptDictionary.RunScript, title: "Run script",
    description: "Manually run a selection script against test input.",
    params: [],
  },
];

export function findAssistantPage(id: string): AssistantPage | undefined {
  return ASSISTANT_PAGES.find(page => page.id === id);
}

// filePath is the currently open draft's file path (from the ":filePath" route
// param) - undefined when no draft is open, in which case only pages without
// ":filePath" in their template can be resolved.
export function resolvePagePath(
  page: AssistantPage, filePath: string | undefined, extraParams?: Record<string, string>
): string {
  const needsFilePath = page.path.includes(":filePath");
  if (needsFilePath && !filePath) {
    throw new Error(`Page "${page.id}" needs an open draft, but none is open`);
  }
  if (!needsFilePath && page.params.length === 0) return page.path;

  return replaceParams(page.path, {
    ...(needsFilePath ? { filePath } : {}),
    ...extraParams,
  });
}
