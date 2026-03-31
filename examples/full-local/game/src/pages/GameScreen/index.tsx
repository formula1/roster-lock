import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { GameEngine, GameState, GameAction } from '../../game-engine';

export function GameScreen() {
  const navigate = useNavigate();
  const { userId, selectedCharacter, selectedStage } = useGame();
  const [engine] = useState(() => new GameEngine());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Initializing game engine...');
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Validate required state - redirect if missing
  useEffect(() => {
    if (!selectedCharacter || !selectedStage) {
      console.error('❌ Missing character or stage selection');
      navigate('/select-character');
      return;
    }
    console.log('✅ Game screen - Character:', selectedCharacter, 'Stage:', selectedStage);
  }, [selectedCharacter, selectedStage, navigate]);

  useEffect(() => {
    // Skip if missing required state
    if (!selectedCharacter || !selectedStage) return;
    // Loading sequence
    const loadingSteps = [
      { text: 'Initializing game engine...', duration: 500 },
      { text: 'Loading piece logic...', duration: 700 },
      { text: 'Preparing battle arena...', duration: 600 },
      { text: 'Establishing WebRTC connections...', duration: 800 },
      { text: 'Synchronizing game state...', duration: 500 },
      { text: 'Ready to battle!', duration: 400 },
    ];

    const runLoadingSequence = async () => {
      for (let i = 0; i < loadingSteps.length; i++) {
        const step = loadingSteps[i];
        setLoadingText(step.text);
        setLoadingProgress(((i + 1) / loadingSteps.length) * 100);
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }

      // Initialize game engine
      engine.onStateChange((state) => {
        setGameState(state);
      });

      engine.onEvent((event) => {
        setBattleLog(prev => [...prev, event.message]);
      });

      // Start battle
      engine.startBattle({
        player1: {
          id: userId,
          character: selectedCharacter || 'fire',
          hp: 100,
          maxHp: 100,
        },
        player2: {
          id: 'opponent',
          character: 'water',
          hp: 100,
          maxHp: 100,
        }
      });

      setIsLoading(false);
    };

    runLoadingSequence();
  }, [engine, userId, selectedCharacter]);

  const handleAction = (actionType: string) => {
    if (!gameState) return;

    const action: GameAction = {
      type: actionType,
      playerId: userId,
      timestamp: Date.now(),
    };

    engine.processAction(action);
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  // Show loading screen
  if (isLoading) {
    return (
      <div className="screen-container">
        <div className="content-box">
          <h1>Loading Game</h1>
          <p className="status">{loadingText}</p>

          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${loadingProgress}%` }} />
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '4em', animation: 'pulse 2s infinite' }}>
              ⚔️
            </div>
            <p style={{ marginTop: '20px', opacity: 0.8 }}>
              Preparing for battle...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div className="screen-container">Initializing...</div>;
  }

  const isMyTurn = gameState.currentTurn === userId;
  const myPlayer = gameState.player1.id === userId ? gameState.player1 : gameState.player2;
  const opponent = gameState.player1.id === userId ? gameState.player2 : gameState.player1;

  return (
    <div className="screen-container">
      <div className="content-box" style={{ maxWidth: '1000px' }}>
        <h1>Battle!</h1>
        <p className="status">
          {gameState.gameOver
            ? `Game Over! ${gameState.winner === userId ? 'You Win!' : 'You Lose!'}`
            : isMyTurn ? 'Your Turn!' : "Opponent's Turn"}
        </p>

        {/* Display selected stage */}
        <div style={{ textAlign: 'center', marginBottom: '20px', opacity: 0.8 }}>
          <span style={{ fontSize: '1.5em' }}>{getStageIcon(selectedStage || '')}</span>
          <span style={{ marginLeft: '10px' }}>{getStageName(selectedStage || '')}</span>
        </div>

        <div className="battle-field">
          {/* Player Area */}
          <div className="player-area">
            <h3>You</h3>
            <div style={{ fontSize: '3em', textAlign: 'center', margin: '10px 0' }}>
              {getCharacterIcon(myPlayer.character)}
            </div>
            <div className="health-bar">
              <div 
                className="health-fill" 
                style={{ 
                  width: `${(myPlayer.hp / myPlayer.maxHp) * 100}%`,
                  background: getHealthColor(myPlayer.hp / myPlayer.maxHp)
                }} 
              />
            </div>
            <p style={{ textAlign: 'center' }}>HP: {myPlayer.hp}/{myPlayer.maxHp}</p>
            {myPlayer.defending && <p style={{ textAlign: 'center', color: '#4ade80' }}>🛡️ Defending</p>}
          </div>

          {/* Opponent Area */}
          <div className="player-area">
            <h3>Opponent</h3>
            <div style={{ fontSize: '3em', textAlign: 'center', margin: '10px 0' }}>
              {getCharacterIcon(opponent.character)}
            </div>
            <div className="health-bar">
              <div 
                className="health-fill" 
                style={{ 
                  width: `${(opponent.hp / opponent.maxHp) * 100}%`,
                  background: getHealthColor(opponent.hp / opponent.maxHp)
                }} 
              />
            </div>
            <p style={{ textAlign: 'center' }}>HP: {opponent.hp}/{opponent.maxHp}</p>
            {opponent.defending && <p style={{ textAlign: 'center', color: '#4ade80' }}>🛡️ Defending</p>}
          </div>
        </div>

        {/* Actions */}
        {!gameState.gameOver && (
          <div className="actions">
            <button onClick={() => handleAction('attack')} disabled={!isMyTurn}>
              ⚔️ Attack
            </button>
            <button onClick={() => handleAction('defend')} disabled={!isMyTurn}>
              🛡️ Defend
            </button>
            <button onClick={() => handleAction('special')} disabled={!isMyTurn}>
              ✨ Special Move
            </button>
            <button onClick={() => handleAction('item')} disabled={!isMyTurn}>
              🧪 Use Item
            </button>
          </div>
        )}

        {gameState.gameOver && (
          <div className="actions">
            <button onClick={handleBackToMenu}>
              Back to Menu
            </button>
          </div>
        )}

        {/* Battle Log */}
        <div style={{ 
          marginTop: '20px', 
          background: 'rgba(0, 0, 0, 0.3)', 
          padding: '15px', 
          borderRadius: '10px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <h3>Battle Log</h3>
          {battleLog.map((entry, idx) => (
            <div key={idx} style={{ 
              padding: '5px 0', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.9em'
            }}>
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getCharacterIcon(character: string): string {
  const icons: Record<string, string> = {
    fire: '🔥',
    water: '💧',
    grass: '🌿',
    electric: '⚡',
  };
  return icons[character] || '❓';
}

function getHealthColor(percentage: number): string {
  if (percentage > 0.5) return 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)';
  if (percentage > 0.25) return 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)';
  return 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
}

function getStageIcon(stage: string): string {
  const icons: Record<string, string> = {
    forest: '🌲',
    volcano: '🌋',
    ocean: '🌊',
    city: '🏙️',
  };
  return icons[stage] || '🎮';
}

function getStageName(stage: string): string {
  const names: Record<string, string> = {
    forest: 'Forest Arena',
    volcano: 'Volcano Arena',
    ocean: 'Ocean Arena',
    city: 'City Arena',
  };
  return names[stage] || 'Unknown Arena';
}

