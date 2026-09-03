
import { AUTH_API } from "./auth";
import { USERS_API } from "./users";
import { MATCHMAKER_API } from "./matchmakers";
import { GAME_COORDINATOR_API } from "./game-coordinators";

export const RELAY_API = {
  auth: AUTH_API,
  users: USERS_API,
  matchmaker: MATCHMAKER_API,
  gameCoordinator: GAME_COORDINATOR_API,
}
