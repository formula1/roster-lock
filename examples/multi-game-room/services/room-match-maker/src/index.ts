import express, { Request, Response } from "express";
import cors from "cors";
import { PORT } from "./globals/env";
import { getSignatureKeys } from "./globals/signature-keys";
import { router as adminGamesRouter } from "./routes/admin-games";
import { router as gamesRouter } from "./routes/games";
import { router as roomsRouter } from "./routes/rooms";

const app = express();
app.use(cors());

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "room-match-maker" });
});

// Public key this service registers as a matchmaker against the Relay Room
// service - see core/relay-server's matchmaker.ts admin route.
app.get("/public-key", async (req: Request, res: Response) => {
  const { publicKey } = await getSignatureKeys();
  res.json({ publicKey });
});

app.use("/admin/games", adminGamesRouter);
app.use("/games", gamesRouter);
app.use("/rooms", roomsRouter);

app.listen(PORT, () => {
  console.log(`Room match maker running on port ${PORT}`);
});
