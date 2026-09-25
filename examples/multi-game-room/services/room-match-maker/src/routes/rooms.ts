
import { Router, json } from "express";
import { createShaFromJSON } from "@roster-lock/utils";
import { createRoomBodySchema, joinRoomBodySchema, selectionReadyBodySchema } from "../schema";
import { verifyUserSignature } from "../utils/auth";
import { deriveHostAddress, connectionConfigFor } from "../utils/connection";
import { getGame } from "../store/games";
import * as roomsStore from "../store/rooms";
import { createRelayRoom } from "../relay-client";
import { PUBLIC_RELAY_SERVER_URL } from "../globals/env";

export const router = Router();

// Create Room
router.post("/", json(), async (req, res) => {
  const casted = createRoomBodySchema.safeParse(req.body);
  if(!casted.success){
    res.status(400).json({ error: "Invalid body", details: casted.error.issues });
    return;
  }
  const body = casted.data;

  const validSignature = await verifyUserSignature(body.creator.publicKey, body.signature, body.timestamp, {
    service: "create-room",
    title: body.title,
    engineSha: body.engineSha,
    gamePluginPackage: body.gamePluginPackage,
    maxPlayers: body.maxPlayers,
    connection: body.connection,
    machineId: body.creator.machineId,
    publicKey: body.creator.publicKey,
    timestamp: body.timestamp,
  });
  if(!validSignature){
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const game = getGame(body.engineSha);
  if(!game){
    res.status(404).json({ error: `No game registered for engineSha "${body.engineSha}"` });
    return;
  }
  if(game.gamePluginPackage !== body.gamePluginPackage){
    res.status(400).json({ error: "gamePluginPackage doesn't match the game registered for this engineSha" });
    return;
  }

  // The client only ever labels its engine with a bare engineSha string -
  // this confirms the roster config it's actually submitting hashes to that
  // same value, rather than trusting the label. Otherwise a room could claim
  // one engine while carrying a roster config for a completely different one.
  const submittedEngineHash = await createShaFromJSON(body.rosterConfig.engine);
  if(submittedEngineHash !== body.engineSha){
    res.status(400).json({ error: "rosterConfig.engine doesn't hash to the supplied engineSha" });
    return;
  }

  if(!game.supportedConnectionModes.includes(body.connection.type)){
    res.status(400).json({
      error: `"${body.connection.type}" isn't supported by this game (supports: ${game.supportedConnectionModes.join(", ")})`,
    });
    return;
  }
  if(body.connection.type === "room"){
    if(!game.supportedRoomVersions?.includes(body.connection.version)){
      res.status(400).json({
        error: `Room version "${body.connection.version}" isn't supported by this game ` +
          `(supports: ${(game.supportedRoomVersions ?? []).join(", ") || "none"})`,
      });
      return;
    }
  }

  let hostAddress: string | undefined;
  if(body.connection.type === "direct-tcp"){
    try {
      hostAddress = deriveHostAddress(req);
    } catch(e){
      res.status(400).json({ error: (e as Error).message });
      return;
    }
  }

  const room = await roomsStore.createRoom(body, hostAddress);
  res.status(201).json(room);
});

// List Rooms - open rooms only, so users can't join/browse into ones that
// already started matching or finished.
router.get("/", (req, res) => {
  res.json(roomsStore.listOpenRooms());
});

// Room detail/status - participants poll this to learn the relay room once
// the match maker has created one.
router.get("/:roomId", (req, res) => {
  const room = roomsStore.getRoom(req.params.roomId);
  if(!room){
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(room);
});

// Per-viewer connection resolution - a room stores one creator-supplied
// connection setup, but the creator (always host) and every other
// participant (always client) need different ConnectionConfig values out of
// it, so this can't just be a field on the room detail response above.
// Signed the same way join/selection-ready are, so a non-participant can't
// probe another participant's resolved connection details (notably the
// host's real IP for direct-tcp) just by knowing their public key.
router.get("/:roomId/connection", async (req, res) => {
  const publicKey = req.query.publicKey;
  const signature = req.query.signature;
  const timestamp = Number(req.query.timestamp);
  if(typeof publicKey !== "string" || typeof signature !== "string" || Number.isNaN(timestamp)){
    res.status(400).json({ error: "publicKey, signature, and timestamp query params are required" });
    return;
  }

  const validSignature = await verifyUserSignature(publicKey, signature, timestamp, {
    service: "room-connection",
    roomId: req.params.roomId,
    publicKey,
    timestamp,
  });
  if(!validSignature){
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const room = roomsStore.getRoom(req.params.roomId);
  if(!room){
    res.status(404).json({ error: "Not found" });
    return;
  }
  if(!room.players.some((p) => p.publicKey === publicKey)){
    res.status(403).json({ error: "Not a participant in this room" });
    return;
  }

  try {
    res.json({ connectionConfig: connectionConfigFor(room, publicKey) });
  } catch(e){
    res.status(409).json({ error: (e as Error).message });
  }
});

// Join Game
router.post("/:roomId/join", json(), async (req, res) => {
  const casted = joinRoomBodySchema.safeParse(req.body);
  if(!casted.success){
    res.status(400).json({ error: "Invalid body", details: casted.error.issues });
    return;
  }
  const body = casted.data;

  const validSignature = await verifyUserSignature(body.player.publicKey, body.signature, body.timestamp, {
    service: "join-room",
    roomId: req.params.roomId,
    machineId: body.player.machineId,
    publicKey: body.player.publicKey,
    timestamp: body.timestamp,
  });
  if(!validSignature){
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  try {
    const room = roomsStore.joinRoom(req.params.roomId, body.player);
    res.json(room);
  } catch(e){
    res.status(400).json({ error: (e as Error).message });
  }
});

// Selection Ready - a lightweight "I've made my picks locally" signal used
// only to decide when to kick off relay-room creation. The actual selection
// sync/lock (commit-reveal over the roster config) happens inside the Relay
// Room itself once it exists, not here.
router.post("/:roomId/selection-ready", json(), async (req, res) => {
  const casted = selectionReadyBodySchema.safeParse(req.body);
  if(!casted.success){
    res.status(400).json({ error: "Invalid body", details: casted.error.issues });
    return;
  }
  const body = casted.data;

  const validSignature = await verifyUserSignature(body.publicKey, body.signature, body.timestamp, {
    service: "selection-ready",
    roomId: req.params.roomId,
    publicKey: body.publicKey,
    timestamp: body.timestamp,
  });
  if(!validSignature){
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let result;
  try {
    result = roomsStore.markSelectionReady(req.params.roomId, body.publicKey);
  } catch(e){
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  if(result.allReady){
    const { room } = result;
    try {
      const relay = await createRelayRoom({
        rosterConfig: room.rosterConfig,
        rosterConfigHash: room.rosterConfigHash,
        machines: room.players.map((p) => ({
          machineId: p.machineId,
          publicKey: p.publicKey,
          displayName: p.displayName,
          playerCount: p.playerCount,
        })),
      });
      roomsStore.setRelayResult(room.roomId, { roomId: relay.roomId, url: PUBLIC_RELAY_SERVER_URL });
    } catch(e){
      roomsStore.setRoomFailed(room.roomId, (e as Error).message);
    }
  }

  res.json(result.room);
});
