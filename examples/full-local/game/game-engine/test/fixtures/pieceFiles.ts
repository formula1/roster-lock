import { PieceFilesConfig } from "../../src/game/assets/loadPieceFile";
import { buildFixtureRosterConfig } from "./rosterConfig";

// matchAgentAuth/matchAgentUrl are unused by fetchStub.ts's stubbed fetch -
// it resolves files straight off disk - but PieceFilesConfig still requires
// them to be present.
export const fixturePieceFiles: PieceFilesConfig = {
  rosterConfig: buildFixtureRosterConfig(),
  matchAgentAuth: "test",
  matchAgentUrl: "http://match-agent.test",
};
