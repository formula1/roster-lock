import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Game, GameState, MoveDescription } from "@roster-lock/example-game-engine";
import { useGameSession } from "../../context/GameSessionContext";
import { prepareWebRTCRoom, PeerRoom } from "../../game/webrtc-room";
import { toGameRoom } from "../../game/room-adapter";
import { describeError } from "../../utils/describeError";
import { Battlefield } from "./Battlefield";
import { MoveForm } from "./MoveForm";

type MoveResolver = (moves: Array<Omit<MoveDescription, "player">>) => void;

export function GameScreen() {
  const navigate = useNavigate();
  const { user, match, users, downloadResult, rosterConfig, matchAgent, finishGame } = useGameSession();

  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [log, setLog] = useState<Array<string>>([]);
  const [waitingGame, setWaitingGame] = useState<Game | null>(null);

  const started = useRef(false);
  const moveResolverRef = useRef<MoveResolver | null>(null);

  useEffect(() => {
    if (started.current) return;
    if (!user || !match || !users || !downloadResult || !rosterConfig) return;
    started.current = true;

    let room: PeerRoom | null = null;

    function requestMoves(game: Game): Promise<Array<Omit<MoveDescription, "player">>> {
      setWaitingGame(game);
      return new Promise((resolve) => {
        moveResolverRef.current = (moves) => {
          setWaitingGame(null);
          moveResolverRef.current = null;
          resolve(moves);
        };
      });
    }

    (async () => {
      try {
        room = await prepareWebRTCRoom(match, users, user, matchAgent.gameCoordinatorUrl);
        const gameRoom = toGameRoom(room);

        // moveRequest closes over `game`, which is only assigned once
        // Game.create resolves - safe because moveRequest is never invoked
        // until gameLoop() runs, strictly after that assignment.
        let game: Game;
        game = await Game.create(gameRoom, downloadResult, () => requestMoves(game), {
          rosterConfig,
          matchAgentAuth: matchAgent.authCode,
          matchAgentUrl: matchAgent.url,
        });

        game.onStateUpdate((name, payload) => {
          setGameState({ ...payload.state });
          if (name === "turnBegin") {
            setLog((prev) => [...prev, `Turn ${payload.state.turnCount + 1} begins.`]);
          } else if (name === "turnEnd") {
            setLog((prev) => [...prev, `Turn ${payload.state.turnCount + 1} ends.`]);
          } else if (name === "gameEnd") {
            setLog((prev) => [...prev, `Game over! Winners: ${payload.winners.join(", ")}`]);
          }
        });

        const winners = await game.gameLoop();
        finishGame({ winners, turnCount: game.gameState.turnCount });
        navigate("/select");
      } catch (err) {
        setError(describeError(err, "Something went wrong during the match."));
      } finally {
        room?.close();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [user, match, users, downloadResult, rosterConfig, matchAgent, finishGame, navigate]);

  if (error) return <div className="banner">{error}</div>;
  if (!gameState || !rosterConfig || !downloadResult || !user) {
    return <p className="status">Connecting to your opponent...</p>;
  }

  return (
    <div>
      <h1>Match Lock</h1>
      <p className="status">Turn {gameState.turnCount + 1}</p>

      <Battlefield
        gameState={gameState}
        rosterConfig={rosterConfig}
        downloadResult={downloadResult}
        localPlayer={user.keys.publicKey}
      />

      {waitingGame && user && (
        <MoveForm
          game={waitingGame}
          localPlayer={user.keys.publicKey}
          rosterConfig={rosterConfig}
          onSubmit={(moves) => moveResolverRef.current?.(moves)}
        />
      )}

      <div className="info-row" style={{ maxHeight: 160, overflowY: "auto" }}>
        {log.map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>
    </div>
  );
}
