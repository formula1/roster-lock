import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "../../context/AccountContext";
import { listRooms, RoomIndexEntry, getRoom, joinRoom } from "../../api/titledRoom";
import { TITLED_ROOM_URL } from "../../config";

export function RoomsBrowsePage() {
  const account = useAccount();
  const { token } = account;
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Array<RoomIndexEntry>>([]);
  const [title, setTitle] = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setActiveTitle(title);
    listRooms(TITLED_ROOM_URL, token, title || undefined).then(setRooms).catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  return (
    <div className="page">
      <h1>Rooms</h1>
      <div className="room-browse-controls">
        <input placeholder="Filter by title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={load}>{
          title === activeTitle ? "Refresh" : "Search"
        }</button>
        <button type="button" onClick={() => navigate("/rooms/create")}>Create Room</button>
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="room-list">
        {rooms.map((r) => (
          <li key={r.id}>
            <button
              onClick={()=>{
                attemptToJoinRoom(r.id, account, navigate);
              }}
            >{r.title}</button>
            {" - "}{r.gameLauncherPlugin} - {r.participantCount}/{r.maxPlayers} players
          </li>
        ))}
      </ul>
      {rooms.length === 0 && !error && <p>No open rooms right now.</p>}
    </div>
  );
}

async function attemptToJoinRoom(
  roomId: string,
  account: ReturnType<typeof useAccount>,
  navigate: ReturnType<typeof useNavigate>
){
  const current = await getRoom(TITLED_ROOM_URL, account.token!, roomId);
  if(current.participants[account.profile!.id]){
    return navigate(`/rooms/${roomId}`)
  }
  const numParticipants = Object.keys(current.participants).length;
  if(numParticipants === current.maxPlayers){
    throw new Error("Already at maximum");
  }
  await joinRoom(TITLED_ROOM_URL, account.token!, roomId, account.identity!.machineId);
  navigate(`/rooms/${roomId}`)
}
