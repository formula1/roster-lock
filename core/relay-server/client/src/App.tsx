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

import { AuthRoute } from "./pages/auth";
import { UsersRoute } from "./pages/users";
import { MatchMakerRoute } from "./pages/matchmaker";
function App() {
  return (
    <Routes>
      <Route path="/" element={<UserProvider><Outlet /></UserProvider>} >
        <Route index element={<Home />} />
        {AuthRoute}
        {UsersRoute}
        {MatchMakerRoute}
      </Route>
    </Routes>
  );
}

export default App;

