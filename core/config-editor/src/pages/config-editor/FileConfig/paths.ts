
import { RosterLockPaths } from "../Form";

export const FileRosterConfigPaths = {
  Root: "/config/:filePath" as const,
  Engine: `/config/:filePath${RosterLockPaths.Engine}` as const,
  EngineTest: `/config/:filePath${RosterLockPaths.EngineTest}` as const,
  Roster: `/config/:filePath${RosterLockPaths.Roster}` as const,
  Selection: `/config/:filePath${RosterLockPaths.Selection}` as const,
}
