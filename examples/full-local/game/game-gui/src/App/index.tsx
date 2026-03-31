import { Router } from './Router';
import { GameProvider } from '../context/GameContext';

function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

export default App;

