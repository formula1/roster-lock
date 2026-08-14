import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MatchAgentProvider } from "./context/MatchAgentContext";
import { IdentityProvider } from "./context/IdentityContext";
import { JoinSettingsProvider } from "./context/JoinSettingsContext";
import { DownloadSessionProvider } from "./context/DownloadSessionContext";
import { ConnectPage } from "./pages/Connect";
import { JoinSettingsPage } from "./pages/JoinSettings";
import { GameRunnerListPage } from "./pages/GameRunner";
import { GameRunnerDetailPage } from "./pages/GameRunner/Detail";
import { MatchMakingPage } from "./pages/MatchMaking";
import { DownloadPage } from "./pages/Download";
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
                <Route path="/game-runner" element={<GameRunnerListPage />} />
                <Route path="/game-runner/:pluginName" element={<GameRunnerDetailPage />} />
                <Route path="/match-making" element={<MatchMakingPage />} />
                <Route path="/download" element={<DownloadPage />} />
              </Routes>
            </BrowserRouter>
          </DownloadSessionProvider>
        </JoinSettingsProvider>
      </IdentityProvider>
    </MatchAgentProvider>
  );
}
