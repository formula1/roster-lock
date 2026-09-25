
import { Router, json } from "express";
import { requireAdmin } from "../utils/auth";
import { addGameBodySchema } from "../schema";
import { addGame, removeGame, packageExistsOnNpm } from "../store/games";

export const router = Router();
router.use(requireAdmin);

// Body is the already-derived {engineSha, gamePluginPackage, gameConfigSchema,
// supportedConnectionModes, publicInfo} an admin's own match-agent produced by
// installing the plugin locally - this route only validates shape and
// dedupes, it never installs or executes the plugin itself.
router.post("/", json(), async (req, res) => {
  const casted = addGameBodySchema.safeParse(req.body);
  if(!casted.success){
    res.status(400).json({ error: "Invalid body", details: casted.error.issues });
    return;
  }

  const exists = await packageExistsOnNpm(casted.data.gamePluginPackage, casted.data.gamePluginVersion);
  if(!exists){
    res.status(400).json({
      error: `${casted.data.gamePluginPackage}@${casted.data.gamePluginVersion} was not found on npm`,
    });
    return;
  }

  try {
    const entry = addGame(casted.data);
    res.status(201).json(entry);
  } catch(e){
    res.status(409).json({ error: (e as Error).message });
  }
});

router.delete("/:engineSha", (req, res) => {
  const removed = removeGame(req.params.engineSha);
  if(!removed){
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});
