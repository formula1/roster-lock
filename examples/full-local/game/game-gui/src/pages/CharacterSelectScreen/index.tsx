import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';

const CHARACTERS = [
  { id: 'fire', name: 'Blaze', icon: '🔥', description: 'Strong attacks' },
  { id: 'water', name: 'Aqua', icon: '💧', description: 'Balanced stats' },
  { id: 'grass', name: 'Leaf', icon: '🌿', description: 'High defense' },
  { id: 'electric', name: 'Volt', icon: '⚡', description: 'Fast attacks' },
];

export function CharacterSelectScreen() {
  const navigate = useNavigate();
  const { setSelectedCharacter } = useGame();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (characterId: string) => {
    setSelected(characterId);
  };

  const handleConfirm = () => {
    if (selected) {
      setSelectedCharacter(selected);
      console.log('✅ Character selected:', selected);
      navigate('/select-stage');
    }
  };

  return (
    <div className="screen-container">
      <div className="content-box">
        <h1>Select Your Character</h1>
        <p className="status">Choose wisely!</p>

        <div className="selection-grid">
          {CHARACTERS.map((character) => (
            <div
              key={character.id}
              className={`selection-card ${selected === character.id ? 'selected' : ''}`}
              onClick={() => handleSelect(character.id)}
            >
              <div style={{ fontSize: '3em' }}>{character.icon}</div>
              <h3>{character.name}</h3>
              <p style={{ fontSize: '0.9em', opacity: 0.8 }}>{character.description}</p>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={handleConfirm} disabled={!selected}>
            Confirm Selection
          </button>
          <button onClick={() => navigate('/matchmaking')}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

