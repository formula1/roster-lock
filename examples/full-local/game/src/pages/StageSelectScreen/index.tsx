import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';

const STAGES = [
  { id: 'forest', name: 'Forest Arena', icon: '🌲', description: 'A peaceful forest clearing' },
  { id: 'volcano', name: 'Volcano Arena', icon: '🌋', description: 'A fiery volcanic crater' },
  { id: 'ocean', name: 'Ocean Arena', icon: '🌊', description: 'A floating platform on the sea' },
  { id: 'city', name: 'City Arena', icon: '🏙️', description: 'An urban rooftop' },
];

export function StageSelectScreen() {
  const navigate = useNavigate();
  const { setSelectedStage } = useGame();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (stageId: string) => {
    setSelected(stageId);
  };

  const handleConfirm = () => {
    if (selected) {
      setSelectedStage(selected);
      console.log('✅ Stage selected:', selected);
      navigate('/download');
    }
  };

  return (
    <div className="screen-container">
      <div className="content-box">
        <h1>Select Stage</h1>
        <p className="status">Choose your battlefield!</p>

        <div className="selection-grid">
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`selection-card ${selected === stage.id ? 'selected' : ''}`}
              onClick={() => handleSelect(stage.id)}
            >
              <div style={{ fontSize: '3em' }}>{stage.icon}</div>
              <h3>{stage.name}</h3>
              <p style={{ fontSize: '0.9em', opacity: 0.8 }}>{stage.description}</p>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={handleConfirm} disabled={!selected}>
            Confirm Selection
          </button>
          <button onClick={() => navigate('/select-character')}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

