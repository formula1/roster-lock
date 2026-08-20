import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RosterLockV1Config } from "@roster-lock/types";
import { useAccount } from "../../context/AccountContext";
import { getRoom, joinRoom, startRoom, destroyRoom, listenToRoom, RoomData, RoomSocket } from "../../api/titledRoom";
import * as bridge from "../../bridge";
import { TITLED_ROOM_URL } from "../../config";

export function RoomDetailPage() {
  const { roomId = "" } = useParams();
  const account = useAccount();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const socketRef = useRef<RoomSocket | null>(null);
  const gameConfigSynced = useRef(false);
  const roomRef = useRef<RoomData | null>(null);
  roomRef.current = room;

  const refresh = () => {
    if (!account.token) return;
    getRoom(TITLED_ROOM_URL, account.token, roomId).then(setRoom).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (!account.token || !account.profile || !account.identity) return;
    let cancelled = false;

    (async () => {
      try {
        const current = await getRoom(TITLED_ROOM_URL, account.token!, roomId);
        if (cancelled) return;
        const withUser = current.participants[account.profile!.id]
          ? current
          : await joinRoom(TITLED_ROOM_URL, account.token!, roomId, account.identity!.machineId);
        if (cancelled) return;
        setRoom(withUser);
        // Every participant's own host shell needs to know this room's
        // gameConfig, not just the creator's - each one ends up calling its
        // own match-agent's start route later.
        if (!gameConfigSynced.current) {
          gameConfigSynced.current = true;
          bridge.updateGameRunnerSettings(withUser.gameRunnerPlugin, withUser.gameConfig).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    const socket = listenToRoom(TITLED_ROOM_URL, account.token, roomId, (event) => {
      if (event.type === "GAME_HAS_STARTED") {
        const currentRoom = roomRef.current;
        if (!currentRoom) return;
        bridge.initiateRelay({
          relay: { url: event.payload.relayUrl, roomId: event.payload.roomId },
          rosterConfig: currentRoom.rosterConfig as RosterLockV1Config,
          gameRunnerPlugin: currentRoom.gameRunnerPlugin,
          isHost: currentRoom.hostUserId === account.profile!.id,
          coordinator: event.payload.coordinator,
        });
        return;
      }
      if (event.type === "ROOM_DESTROYED") {
        // The room's storage is already gone by the time this arrives (see
        // RoomSession's /destroy) - refresh() would just 404, so leave
        // straight for the list instead of showing a broken room page.
        navigate("/rooms");
        return;
      }
      refresh();
    });
    socketRef.current = socket;

    return () => {
      cancelled = true;
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, account.token]);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!room || !account.profile) return <div className="page"><p>Loading room...</p></div>;

  const myParticipant = room.participants[account.profile.id];
  const isHost = room.hostUserId === account.profile.id;
  const participants = Object.values(room.participants);
  const allReady = participants.every((p) => p.ready);
  const totalPlayers = participants.reduce((sum, p) => sum + p.playerCount, 0);
  const canStart = isHost && allReady && totalPlayers >= room.minPlayers;

  const handleSelect = async () => {
    if (!myParticipant) return;
    setSelecting(true);
    setError(null);
    try {
      await bridge.requestSelection(room.rosterConfig as RosterLockV1Config, myParticipant.playerCount);
      setSelected(true);
      socketRef.current?.sendReady();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSelecting(false);
    }
  };

  const handleStart = async () => {
    if (!account.token) return;
    try {
      await startRoom(TITLED_ROOM_URL, account.token, roomId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCancel = async () => {
    if (!account.token) return;
    setCancelling(true);
    setError(null);
    try {
      await destroyRoom(TITLED_ROOM_URL, account.token, roomId);
      // Don't wait on the room's own ROOM_DESTROYED broadcast to get here -
      // this request already succeeded, so leave immediately rather than
      // depending on this same session's websocket round-trip.
      navigate("/rooms");
    } catch (e) {
      setError((e as Error).message);
      setCancelling(false);
    }
  };

  return (
    <div className="page">
      <h1>{room.title}</h1>
      <p>{room.gameRunnerPlugin} - {totalPlayers}/{room.maxPlayers} players (min {room.minPlayers})</p>

      <ul className="participant-list">
        {participants.map((p) => (
          <li key={p.userId}>
            {p.displayName ?? p.identifier} - {p.ready ? "Ready" : "Not ready"}
            {p.userId === room.hostUserId ? " (host)" : ""}
          </li>
        ))}
      </ul>

      {myParticipant && !myParticipant.ready && (
        <button type="button" disabled={selecting || selected} onClick={handleSelect}>
          {selecting ? "Waiting for selection..." : "Make Selection"}
        </button>
      )}
      {myParticipant?.ready && <p>Waiting for other players...</p>}

      {isHost && (
        <button type="button" disabled={!canStart} onClick={handleStart}>
          Start Match
        </button>
      )}
      {isHost && room.status !== "started" && (
        <button type="button" disabled={cancelling} onClick={handleCancel}>
          {cancelling ? "Cancelling..." : "Cancel Room"}
        </button>
      )}
    </div>
  );
}
