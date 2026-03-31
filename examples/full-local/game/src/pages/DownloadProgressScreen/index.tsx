import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/tauri';
import { useGame } from '../../context/GameContext';

interface DownloadItem {
  name: string;
  type: string;
  progress: number;
  status: 'pending' | 'downloading' | 'complete';
}

export function DownloadProgressScreen() {
  const navigate = useNavigate();
  const { matchInfo, userId, userKeys, selectedCharacter, selectedStage } = useGame();
  const [overallProgress, setOverallProgress] = useState(0);
  const [connected, setConnected] = useState(false);

  // Validate required state - redirect if missing
  useEffect(() => {
    if (!selectedCharacter || !selectedStage) {
      console.error('❌ Missing character or stage selection');
      navigate('/select-character');
      return;
    }
    console.log('✅ Download screen - Character:', selectedCharacter, 'Stage:', selectedStage);
  }, [selectedCharacter, selectedStage, navigate]);

  // Initialize downloads based on context state
  const [downloads, setDownloads] = useState<DownloadItem[]>([
    { name: 'Life Bar UI', type: 'mandatory', progress: 0, status: 'pending' },
    { name: `Stage: ${selectedStage || 'Unknown'}`, type: 'shared', progress: 0, status: 'pending' },
    { name: `Character: ${selectedCharacter || 'Unknown'}`, type: 'personal', progress: 0, status: 'pending' },
  ]);

  useEffect(() => {
    // Connect to relay server
    const connectToRelay = async () => {
      if (!matchInfo || !userKeys) return;

      try {
        await invoke('connect_to_relay', {
          room_id: matchInfo.roomId,
          url: matchInfo.url,
          user_id: userId,
          public_key: userKeys.publicKey
        });
        setConnected(true);
      } catch (error) {
        console.error('Failed to connect to relay:', error);
      }
    };

    connectToRelay();
  }, [matchInfo, userId, userKeys]);

  useEffect(() => {
    if (!connected) return;

    // Simulate piece downloads
    const simulateDownloads = async () => {
      for (let i = 0; i < downloads.length; i++) {
        // Update status to downloading
        setDownloads(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'downloading' as const } : item
        ));

        // Simulate download progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setDownloads(prev => prev.map((item, idx) => 
            idx === i ? { ...item, progress } : item
          ));
        }

        // Mark as complete
        setDownloads(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'complete' as const, progress: 100 } : item
        ));

        // Update overall progress
        setOverallProgress(((i + 1) / downloads.length) * 100);
      }

      // All downloads complete, move to game screen
      setTimeout(() => {
        navigate('/game');
      }, 500);
    };

    simulateDownloads();
  }, [connected, navigate]);

  return (
    <div className="screen-container">
      <div className="content-box">
        <h1>Downloading Pieces</h1>
        <p className="status">Loading game assets...</p>

        {/* Show selected character and stage */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '30px',
          marginTop: '20px',
          padding: '15px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px' }}>Your Character</div>
            <div style={{ fontSize: '2em' }}>{getCharacterIcon(selectedCharacter || '')}</div>
            <div style={{ fontSize: '0.9em', marginTop: '5px' }}>{getCharacterName(selectedCharacter || '')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8em', opacity: 0.7, marginBottom: '5px' }}>Stage</div>
            <div style={{ fontSize: '2em' }}>{getStageIcon(selectedStage || '')}</div>
            <div style={{ fontSize: '0.9em', marginTop: '5px' }}>{getStageName(selectedStage || '')}</div>
          </div>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3>Overall Progress</h3>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <p style={{ textAlign: 'center', marginTop: '10px' }}>
            {Math.round(overallProgress)}%
          </p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3>Downloads</h3>
          {downloads.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>
                  {item.name} <span style={{ opacity: 0.6 }}>({item.type})</span>
                </span>
                <span>
                  {item.status === 'pending' && '⏳'}
                  {item.status === 'downloading' && '⬇️'}
                  {item.status === 'complete' && '✅'}
                </span>
              </div>
              <div className="progress-bar" style={{ height: '20px' }}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '30px', fontSize: '0.9em', opacity: 0.8 }}>
          <p>📦 Mandatory pieces: Loaded before game starts</p>
          <p>🌍 Shared pieces: Selected and shared between players</p>
          <p>👤 Personal pieces: Your character and abilities</p>
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

function getCharacterName(character: string): string {
  const names: Record<string, string> = {
    fire: 'Blaze',
    water: 'Aqua',
    grass: 'Leaf',
    electric: 'Volt',
  };
  return names[character] || 'Unknown';
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
