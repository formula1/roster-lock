import { requireEnv } from "../utils/env";

import { RosterLockV1Config } from "@roster-lock/types";
import { makeSelect } from "./0-select";
import { joinMatch } from "./1-matchmaking";
import { relayAndDownload } from "./2-relay-download";
import { runGame } from "./3-game";
import { CurrentUser } from "./types";

const PUBLIC_RELAY_SERVER_URL = requireEnv("PUBLIC_RELAY_SERVER_URL");
const MATCH_AGENT_AUTH = requireEnv("MATCH_AGENT_AUTH");
const MATCH_AGENT_URL = requireEnv("MATCH_AGENT_URL");

export async function runSteps(
  user: CurrentUser,
  rosterConfig: RosterLockV1Config,
){
  const selection = await makeSelect(rosterConfig);
  const match = await joinMatch(user, rosterConfig, requireEnv("PUBLIC_MATCHMAKER_URL"));
  const { users, gameResult } = await relayAndDownload(
    {
      version: 1,
      relay: {
        url: PUBLIC_RELAY_SERVER_URL,
        roomId: match.roomId,
      },
      machine: user,
      rosterConfig,
      playerSelections: { 0: selection },
    },
    MATCH_AGENT_AUTH,
    MATCH_AGENT_URL,
  );
  return runGame(user, match, users, gameResult, {
    rosterConfig,
    matchAgentAuth: MATCH_AGENT_AUTH,
    matchAgentUrl: MATCH_AGENT_URL,
  });
}
