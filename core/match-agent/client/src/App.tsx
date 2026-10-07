import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MatchAgentProvider, useMatchAgent } from "./context/MatchAgentContext";
import { IdentityProvider } from "./context/IdentityContext";
import { JoinSettingsProvider } from "./context/JoinSettingsContext";
import { DownloadSessionProvider } from "./context/DownloadSessionContext";
import { GlobalNavProvider } from "./context/GlobalNavContext";
import { ConnectPage } from "./pages/Connect";
import { JoinSettingsPage } from "./pages/JoinSettings";
import { GameLauncherListPage } from "./pages/GameLauncher";
import { GameLauncherDetailPage } from "./pages/GameLauncher/Detail";
import { MatchMakingPage } from "./pages/MatchMaking";
import { DownloadPage } from "./pages/Download";
import { GameStatusPage } from "./pages/Game";
import { ControlsPage } from "./pages/Controls";
import { PreviewRosterPage } from "./pages/PreviewRoster";
import { NavBar } from "./NavBar";
import { RequireConnection } from "./components/RequireConnection";

export default function App() {
  return (
    <MatchAgentProvider>
      <IdentityProvider>
        <JoinSettingsProvider>
          <DownloadSessionProvider>
            <ConnectOrApp />
          </DownloadSessionProvider>
        </JoinSettingsProvider>
      </IdentityProvider>
    </MatchAgentProvider>
  );
}


function ConnectOrApp(){
  const { connected } = useMatchAgent()

  if(!connected){
    return <ConnectPage autoSubmit />
  };

  return (
  <BrowserRouter>
    <GlobalNavProvider>
      <NavBar />
      <main id="page-content">
        <Routes>
          <Route path="/" element={<Navigate to="/match-making" replace />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/join-settings" element={<RequireConnection><JoinSettingsPage /></RequireConnection>} />
          <Route path="/game-launcher" element={<RequireConnection><GameLauncherListPage /></RequireConnection>} />
          <Route
            path="/game-launcher/:pluginName"
            element={<RequireConnection><GameLauncherDetailPage /></RequireConnection>}
          />
          <Route path="/match-making" element={<RequireConnection><MatchMakingPage /></RequireConnection>} />
          <Route path="/download" element={<RequireConnection><DownloadPage /></RequireConnection>} />
          <Route path="/game" element={<RequireConnection><GameStatusPage /></RequireConnection>} />
          <Route path="/controls" element={<RequireConnection><ControlsPage /></RequireConnection>} />
          <Route path="/preview-roster" element={<RequireConnection><PreviewRosterPage /></RequireConnection>} />
        </Routes>
      </main>
    </GlobalNavProvider>
  </BrowserRouter>
  )
}
