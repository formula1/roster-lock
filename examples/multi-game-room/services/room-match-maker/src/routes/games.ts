
import { Router } from "express";
import { listGames } from "../store/games";

// Public read of the games catalog - separate from /admin/games (which is
// auth-gated for add/remove). Users need this to know which engineSha /
// gamePluginPackage / connection modes / gameConfigSchema are even available
// before they can create a room.
export const router = Router();

router.get("/", (req, res) => {
  res.json(listGames());
});
