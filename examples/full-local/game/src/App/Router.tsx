import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StartScreen } from '../pages/StartScreen';
import { MatchmakingScreen } from '../pages/MatchmakingScreen';
import { CharacterSelectScreen } from '../pages/CharacterSelectScreen';
import { StageSelectScreen } from '../pages/StageSelectScreen';
import { DownloadProgressScreen } from '../pages/DownloadProgressScreen';
import { GameScreen } from '../pages/GameScreen';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/matchmaking" element={<MatchmakingScreen />} />
        <Route path="/select-character" element={<CharacterSelectScreen />} />
        <Route path="/select-stage" element={<StageSelectScreen />} />
        <Route path="/download" element={<DownloadProgressScreen />} />
        <Route path="/game" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

