import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { generateKeyPair } from '../../utils/crypto';

export function StartScreen() {
  const navigate = useNavigate();
  const { setUserId, setDisplayName, setUserKeys } = useGame();

  useEffect(() => {
    // Generate user credentials on mount
    const initUser = async () => {
      const keys = await generateKeyPair();
      const id = `user_${Math.random().toString(36).substring(7)}`;
      const name = `Player_${Math.random().toString(36).substring(7)}`;
      
      setUserId(id);
      setDisplayName(name);
      setUserKeys(keys);
      
      console.log('User initialized:', { id, name, publicKey: keys.publicKey });
    };
    
    initUser();
  }, [setUserId, setDisplayName, setUserKeys]);

  const handleStart = () => {
    navigate('/matchmaking');
  };

  return (
    <div className="screen-container">
      <div className="content-box">
        <h1>🎮 Match Lock Game</h1>
        <p className="status">A turn-based battle game with dynamic piece loading</p>
        
        <div className="actions">
          <button onClick={handleStart}>
            Start Game
          </button>
        </div>

        <div style={{ marginTop: '40px', fontSize: '0.9em', opacity: 0.8 }}>
          <h3>Features:</h3>
          <ul style={{ textAlign: 'left', marginTop: '10px' }}>
            <li>Matchmaking with other players</li>
            <li>Character and stage selection</li>
            <li>Dynamic piece loading system</li>
            <li>Turn-based Pokemon-style battles</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

