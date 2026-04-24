import { RosterLockPaths } from "../Form";


export const NewRosterConfigPaths = {
  Root: "/config/new" as const,
  Engine: `/config/new${RosterLockPaths.Engine}` as const,
  EngineTest: `/config/new${RosterLockPaths.EngineTest}` as const,
  Roster: `/config/new${RosterLockPaths.Roster}` as const,
  Selection: `/config/new${RosterLockPaths.Selection}` as const,
};
