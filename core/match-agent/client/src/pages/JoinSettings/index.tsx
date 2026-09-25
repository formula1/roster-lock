import { useNavigate } from "react-router-dom";
import { useJoinSettings } from "../../context/JoinSettingsContext";
import { useGamepads } from "../../hooks/useGamepads";

// "Join Settings": how many local players this machine brings to a room and
// which input device each uses (keyboard or a gamepad/USB controller). Only
// one slot may claim the keyboard - see JoinSettingsContext's addSlot for
// why. This player count is exposed to whatever matchmaker is loaded via the
// getIdentity bridge call (see bridge/hostBridge.ts) - it's the matchmaker's
// own job to push it to its account/auth backend, not this app's.
export function JoinSettingsPage() {
  const { playerSlots, addSlot, removeSlot, setSlotInput, setSlotLabel } = useJoinSettings();
  const gamepads = useGamepads();
  const navigate = useNavigate();

  const keyboardTaken = playerSlots.some((s) => s.input.type === "keyboard");

  return (
    <div className="page">
      <h1>Join Settings</h1>
      <p>
        Ikemen GO only supports 1v1 today - additional local player slots are saved for future
        team-mode support (2v2, 3v(2+1), etc).
      </p>

      {playerSlots.map((slot) => (
        <div key={slot.id} className="player-slot-row">
          <input value={slot.label} onChange={(e) => setSlotLabel(slot.id, e.target.value)} />
          <select
            value={slot.input.type === "keyboard" ? "keyboard" : `gamepad:${slot.input.index}`}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "keyboard") setSlotInput(slot.id, { type: "keyboard" });
              else setSlotInput(slot.id, { type: "gamepad", index: Number(value.split(":")[1]) });
            }}
          >
            <option value="keyboard" disabled={keyboardTaken && slot.input.type !== "keyboard"}>
              Keyboard
            </option>
            {gamepads.map((g) => (
              <option key={g.index} value={`gamepad:${g.index}`}>{g.id || `Gamepad ${g.index + 1}`}</option>
            ))}
            {gamepads.length === 0 && slot.input.type === "gamepad" && (
              <option value={`gamepad:${slot.input.index}`}>Gamepad {slot.input.index + 1} (not detected)</option>
            )}
          </select>
          <button type="button" onClick={() => removeSlot(slot.id)} disabled={playerSlots.length <= 1}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={addSlot}>Add local player</button>

      <button type="button" onClick={() => navigate("/match-making")}>Continue</button>
    </div>
  );
}
