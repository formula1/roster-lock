import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameSessionProvider, useGameSession } from "./context/GameSessionContext";
import { RequireStep } from "./router/RequireStep";
import { ConnectScreen } from "./pages/Connect";
import { SettingsScreen } from "./pages/Settings";
import { RosterUploadScreen } from "./pages/RosterUpload";
import { SelectScreen } from "./pages/Select";
import { MatchmakingScreen } from "./pages/Matchmaking";
import { DownloadScreen } from "./pages/Download";
import { GameScreen } from "./pages/Game";

function Screens() {
  const { connected, rosterConfig, selection, match, downloadResult } = useGameSession();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/connect" replace />} />
      <Route path="/connect" element={<ConnectScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route
        path="/roster"
        element={
          <RequireStep ok={connected} redirectTo="/connect">
            <RosterUploadScreen />
          </RequireStep>
        }
      />
      <Route
        path="/select"
        element={
          <RequireStep ok={!!rosterConfig} redirectTo="/roster">
            <SelectScreen />
          </RequireStep>
        }
      />
      <Route
        path="/matchmaking"
        element={
          <RequireStep ok={!!selection} redirectTo="/select">
            <MatchmakingScreen />
          </RequireStep>
        }
      />
      <Route
        path="/download"
        element={
          <RequireStep ok={!!match} redirectTo="/matchmaking">
            <DownloadScreen />
          </RequireStep>
        }
      />
      <Route
        path="/game"
        element={
          <RequireStep ok={!!downloadResult} redirectTo="/select">
            <GameScreen />
          </RequireStep>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <GameSessionProvider>
      <BrowserRouter>
        <div className="screen">
          <Screens />
        </div>
      </BrowserRouter>
    </GameSessionProvider>
  );
}

export default App;
