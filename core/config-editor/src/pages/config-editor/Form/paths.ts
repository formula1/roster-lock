
import { ScriptDictionaryPaths } from "./Selection/ScriptDictionary";

export const RosterLockPaths = {
  Root: "/" as const,
  Engine: "/engine" as const,
  EngineTest: "/engine/test" as const,
  Roster: "/roster" as const,
  Selection: {
    INDEX: "/selection" as const,
    ScriptDictionary: ScriptDictionaryPaths
  }
}
