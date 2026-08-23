import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MatchAgentProvider } from "./context/MatchAgentContext";
import { IdentityProvider } from "./context/IdentityContext";
import { JoinSettingsProvider } from "./context/JoinSettingsContext";
import { DownloadSessionProvider } from "./context/DownloadSessionContext";
import { ConnectPage } from "./pages/Connect";
import { JoinSettingsPage } from "./pages/JoinSettings";
import { GameLauncherListPage } from "./pages/GameLauncher";
import { GameLauncherDetailPage } from "./pages/GameLauncher/Detail";
import { MatchMakingPage } from "./pages/MatchMaking";
import { DownloadPage } from "./pages/Download";
import { GameStatusPage } from "./pages/Game";
import { NavBar } from "./NavBar";

export default function App() {
  return (
    <MatchAgentProvider>
      <IdentityProvider>
        <JoinSettingsProvider>
          <DownloadSessionProvider>
            <BrowserRouter>
              <NavBar />
              <Routes>
                <Route path="/" element={<Navigate to="/connect" replace />} />
                <Route path="/connect" element={<ConnectPage />} />
                <Route path="/join-settings" element={<JoinSettingsPage />} />
                <Route path="/game-launcher" element={<GameLauncherListPage />} />
                <Route path="/game-launcher/:pluginName" element={<GameLauncherDetailPage />} />
                <Route path="/match-making" element={<MatchMakingPage />} />
                <Route path="/download" element={<DownloadPage />} />
                <Route path="/game" element={<GameStatusPage />} />
              </Routes>
            </BrowserRouter>
          </DownloadSessionProvider>
        </JoinSettingsProvider>
      </IdentityProvider>
    </MatchAgentProvider>
  );
}
