import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AccountProvider, useAccount } from "./context/AccountContext";
import { AccountPage } from "./pages/Account";
import { RoomsBrowsePage } from "./pages/Rooms";
import { CreateRoomPage } from "./pages/Rooms/Create";
import { RoomDetailPage } from "./pages/Rooms/RoomDetail";
import { announceReady } from "./bridge";

function RequireAccount({ children }: { children: React.ReactNode }) {
  const { token } = useAccount();
  return token ? <>{children}</> : <Navigate to="/account" replace />;
}

export default function App() {
  useEffect(() => {
    announceReady();
  }, []);

  return (
    <AccountProvider>
      {/* HashRouter: this app is always embedded in a host's <iframe>, and a
          path-based router would need server-side rewrite support the host
          shell has no reason to provide for an arbitrary matchmaker URL. */}
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/account" replace />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/rooms" element={<RequireAccount><RoomsBrowsePage /></RequireAccount>} />
          <Route path="/rooms/create" element={<RequireAccount><CreateRoomPage /></RequireAccount>} />
          <Route path="/rooms/:roomId" element={<RequireAccount><RoomDetailPage /></RequireAccount>} />
        </Routes>
      </HashRouter>
    </AccountProvider>
  );
}
