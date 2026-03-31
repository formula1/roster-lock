import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/tauri';
import { useGame } from '../../context/GameContext';
import { signMessage } from '../../utils/crypto';

export function MatchmakingScreen() {
  const navigate = useNavigate();
  const { userId, displayName, userKeys, setMatchInfo } = useGame();
  const [status, setStatus] = useState('Ready to join queue');
  const [inQueue, setInQueue] = useState(false);

  const handleJoinQueue = async () => {
    if (!userKeys) {
      setStatus('Error: User keys not initialized');
      return;
    }

    setStatus('Joining matchmaking queue...');

    // Simple roster config for testing
    const rosterConfig = {
      version: 1,
      engine: {
        name: 'simple-battle',
        version: '1.0.0',
        pieceDefinitions: {
          character: {
            selectionStrategy: 'personal',
            requires: [],
            pathVariables: [],
            assets: []
          },
          stage: {
            selectionStrategy: 'shared',
            requires: [],
            pathVariables: [],
            assets: []
          }
        }
      },
      rosters: {
        character: [],
        stage: []
      },
      selection: {
        piece: {
          character: { type: 'normal' },
          stage: { type: 'preselected', pieces: [] }
        }
      }
    };

    // Sign the join request
    const signatureData = {
      service: 'join-queue',
      userId,
      displayName,
      rosterHash: 'test-hash',
      publicKey: userKeys.publicKey
    };

    const signature = await signMessage(userKeys.privateKey, JSON.stringify(signatureData));

    try {
      await invoke('join_matchmaking_queue', {
        request: {
          user_id: userId,
          display_name: displayName,
          roster_config: rosterConfig,
          public_key: userKeys.publicKey,
          signature
        }
      });

      setStatus('In queue, waiting for match...');
      setInQueue(true);
    } catch (error) {
      setStatus(`Error: ${error}`);
      console.error('Failed to join queue:', error);
    }
  };

  useEffect(() => {
    if (!inQueue || !userKeys) return;

    const pollForMatch = async () => {
      const signatureData = {
        service: 'queue-status',
        rosterConfigHash: 'test-hash',
        publicKey: userKeys.publicKey
      };

      const signature = await signMessage(userKeys.privateKey, JSON.stringify(signatureData));

      try {
        const matchStatus: any = await invoke('check_match_status', {
          roster_hash: 'test-hash',
          public_key: userKeys.publicKey,
          signature
        });

        if (matchStatus.status === 'waiting') {
          setStatus('Still waiting for match...');
        } else if (matchStatus.room_id) {
          setStatus('Match found! Connecting...');
          setMatchInfo({
            roomId: matchStatus.room_id,
            url: matchStatus.url
          });
          navigate('/select-character');
        }
      } catch (error) {
        console.error('Error checking match status:', error);
      }
    };

    const interval = setInterval(pollForMatch, 2000);
    return () => clearInterval(interval);
  }, [inQueue, userKeys, setMatchInfo, navigate]);

  return (
    <div className="screen-container">
      <div className="content-box">
        <h1>Matchmaking</h1>
        <p className="status">{status}</p>

        {!inQueue && (
          <div className="actions">
            <button onClick={handleJoinQueue}>
              Join Queue
            </button>
            <button onClick={() => navigate('/')}>
              Back
            </button>
          </div>
        )}

        {inQueue && (
          <div style={{ marginTop: '30px' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%', animation: 'pulse 2s infinite' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.9em', opacity: 0.8 }}>
              Searching for opponents...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

