import { Routes, Route, Outlet } from 'react-router-dom';
import { UserProvider } from './globals/user';

function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Relay Room Client</h1>
      <p>React client for the relay server.</p>
    </div>
  );
}

import { AuthRoute, AuthPaths } from "./pages/auth";
import { UsersRoute, UsersPaths } from "./pages/users";
import { MatchMakerRoute, MatchMakerPaths } from "./pages/matchmaker";
import { GameCoordinatorRoute, GameCoordinatorPaths } from "./pages/game-coordinators";
import { NotFound } from "./pages/error/notfound";
function App() {
  return (
    <Routes>
      <Route path="/" element={<UserProvider><MainMenu /><Outlet /></UserProvider>} >
        <Route index element={<Home />} />
        {AuthRoute}
        {UsersRoute}
        {MatchMakerRoute}
        {GameCoordinatorRoute}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;

import { Link } from "react-router-dom";
import { useUser } from "./globals/user";
function MainMenu() {
  const { user, logout } = useUser();
  return (
    <div>
      <h1>Relay Server</h1>
      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link to="/">Home</Link>
        <Link to={UsersPaths.root}>Users</Link>
        <Link to={MatchMakerPaths.root}>Match Makers</Link>
        <Link to={GameCoordinatorPaths.root}>Game Coordinators</Link>
        <div style={{ flexGrow: 1 }} />
        {user ? (
          <>
            <Link to={AuthPaths.self}>Self</Link>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <Link to={AuthPaths.login}>Login</Link>
        )}
      </nav>
    </div>
  );
}

