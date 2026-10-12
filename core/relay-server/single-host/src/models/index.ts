// Every model is an interface (see ./types) with a swappable implementation,
// picked by MODELS_VERSION - "memory" for now, "postgres" for a real
// database. Swapping in another one later means adding a new implementation
// here and pointing MODELS_VERSION at it, without touching call sites.
export * from "./types";

import { join } from "path";
import { getModelsVersion } from "../globals";
import { InMemoryAdminsModel } from "./memory/admins";
import { InMemoryMatchmakersModel } from "./memory/matchmakers";
import { InMemoryGameCoordinatorsModel } from "./memory/game-coordinators";
import { InMemoryRoomStatsModel } from "./memory/room-stats";
import { createPostgresPool } from "./postgres/pool";
import { runMigrations } from "./postgres/migrate";
import { PostgresAdminsModel } from "./postgres/admins";
import { PostgresMatchmakersModel } from "./postgres/matchmakers";
import { PostgresGameCoordinatorsModel } from "./postgres/game-coordinators";
import { PostgresRoomStatsModel } from "./postgres/room-stats";
import { IAdminsModel, IMatchmakersModel, IGameCoordinatorsModel, IRoomStatsModel } from "./types";

type Models = {
  adminsModel: IAdminsModel;
  matchmakersModel: IMatchmakersModel;
  gameCoordinatorsModel: IGameCoordinatorsModel;
  roomStatsModel: IRoomStatsModel;
};

// `migrate` is a no-op for "memory" - only "postgres" has a schema to bring
// up. Kept separate from model construction (which stays synchronous, same
// as ../message-queue not blocking on redis connecting) so the caller
// decides when to await it - see ../index.ts, which awaits it before the
// server starts accepting connections.
function createModels(): { models: Models; migrate: () => Promise<void> } {
  const version = getModelsVersion();
  switch (version) {
    case "postgres": {
      const pool = createPostgresPool();
      return {
        models: {
          adminsModel: new PostgresAdminsModel(pool),
          matchmakersModel: new PostgresMatchmakersModel(pool),
          gameCoordinatorsModel: new PostgresGameCoordinatorsModel(pool),
          roomStatsModel: new PostgresRoomStatsModel(pool),
        },
        migrate: () => runMigrations(pool, join(__dirname, "postgres/migrations")),
      };
    }
    case "memory":
      return {
        models: {
          adminsModel: new InMemoryAdminsModel(),
          matchmakersModel: new InMemoryMatchmakersModel(),
          gameCoordinatorsModel: new InMemoryGameCoordinatorsModel(),
          roomStatsModel: new InMemoryRoomStatsModel(),
        },
        migrate: async () => {},
      };
  }
}

const { models, migrate } = createModels();
export const adminsModel: IAdminsModel = models.adminsModel;
export const matchmakersModel: IMatchmakersModel = models.matchmakersModel;
export const gameCoordinatorsModel: IGameCoordinatorsModel = models.gameCoordinatorsModel;
export const roomStatsModel: IRoomStatsModel = models.roomStatsModel;
export const migrateModels: () => Promise<void> = migrate;
