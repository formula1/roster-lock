import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "../../context/AccountContext";
import { listRooms, RoomIndexEntry } from "../../api/titledRoom";
import { TITLED_ROOM_URL } from "../../config";

export function RoomsBrowsePage() {
  const { token } = useAccount();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Array<RoomIndexEntry>>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    listRooms(TITLED_ROOM_URL, token, title || undefined).then(setRooms).catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  return (
    <div className="page">
      <h1>Rooms</h1>
      <div className="room-browse-controls">
        <input placeholder="Filter by title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={load}>Search</button>
        <button type="button" onClick={() => navigate("/rooms/create")}>Create Room</button>
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="room-list">
        {rooms.map((r) => (
          <li key={r.id}>
            <Link to={`/rooms/${r.id}`}>{r.title}</Link>
            {" - "}{r.gameLauncherPlugin} - {r.participantCount}/{r.maxPlayers} players
          </li>
        ))}
      </ul>
      {rooms.length === 0 && !error && <p>No open rooms right now.</p>}
    </div>
  );
}
