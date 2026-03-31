import React from 'react';

/**
 * Default HUD Component
 *
 * Sits on top of the game canvas and displays real-time game state.
 * Receives gameState as props.
 *
 * Expected gameState shape:
 * {
 *   players: [
 *     { name: string, hp: number, maxHp: number, character: string },
 *     { name: string, hp: number, maxHp: number, character: string },
 *   ],
 *   turn: number,
 *   weather: { type: 'none' | 'sun' | 'rain' | 'snow', turnsLeft: number },
 * }
 */

function HpBar({ current, max }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? '#4ade80' : pct > 25 ? '#fbbf24' : '#ef4444';
  return (
    <div style={{ width: '100%', background: '#1f2937', borderRadius: 4, height: 14, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.3s' }} />
    </div>
  );
}

const WEATHER_ICONS = { none: '', sun: '☀️', rain: '🌧️', snow: '❄️' };

export default function HUD({ gameState }) {
  if (!gameState) return null;
  const { players = [], turn = 0, weather = { type: 'none', turnsLeft: 0 } } = gameState;
  const [p1, p2] = players;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '8px 12px',
      background: 'rgba(0,0,0,0.55)',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: 13,
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      {/* Player 1 */}
      {p1 && (
        <div style={{ width: 160 }}>
          <div style={{ marginBottom: 4, fontWeight: 'bold' }}>{p1.name} ({p1.character})</div>
          <HpBar current={p1.hp} max={p1.maxHp} />
          <div style={{ marginTop: 2 }}>{p1.hp} / {p1.maxHp} HP</div>
        </div>
      )}

      {/* Center info */}
      <div style={{ textAlign: 'center' }}>
        <div>Turn {turn}</div>
        {weather.type !== 'none' && (
          <div style={{ marginTop: 4 }}>
            {WEATHER_ICONS[weather.type]} {weather.type} ({weather.turnsLeft} turns)
          </div>
        )}
      </div>

      {/* Player 2 */}
      {p2 && (
        <div style={{ width: 160, textAlign: 'right' }}>
          <div style={{ marginBottom: 4, fontWeight: 'bold' }}>{p2.name} ({p2.character})</div>
          <HpBar current={p2.hp} max={p2.maxHp} />
          <div style={{ marginTop: 2 }}>{p2.hp} / {p2.maxHp} HP</div>
        </div>
      )}
    </div>
  );
}

