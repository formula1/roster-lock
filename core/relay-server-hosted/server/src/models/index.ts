// No database's been picked yet, so every model is an interface (see
// ./types) with a swappable implementation - ./memory is the only one for
// now. Swapping in a real DB later means adding a new implementation here
// and pointing these exports at it, without touching call sites.
export * from "./types";

import { InMemoryAdminsModel } from "./memory/admins";
import { InMemoryMatchmakersModel } from "./memory/matchmakers";
import { InMemoryGameCoordinatorsModel } from "./memory/game-coordinators";
import { InMemoryRoomStatsModel } from "./memory/room-stats";
import { IAdminsModel, IMatchmakersModel, IGameCoordinatorsModel, IRoomStatsModel } from "./types";

export const adminsModel: IAdminsModel = new InMemoryAdminsModel();
export const matchmakersModel: IMatchmakersModel = new InMemoryMatchmakersModel();
export const gameCoordinatorsModel: IGameCoordinatorsModel = new InMemoryGameCoordinatorsModel();
export const roomStatsModel: IRoomStatsModel = new InMemoryRoomStatsModel();
