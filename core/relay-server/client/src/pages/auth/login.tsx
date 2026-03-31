import { useState } from 'react';
import { useUser } from "../../globals/user";
import { RunnableState, useRunnable } from "../../utils/runnable";

export function Login() {
  const { login } = useUser();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const loginResult = useRunnable(async ()=>{
    await login(username, password);
  })

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={(e)=>{
        e.preventDefault();
        loginResult.run()
      }}>
        <div>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loginResult.state === RunnableState.PENDING}
        >{loginResult.state === RunnableState.PENDING ? "Logging in..." : "Login"}</button>
        {loginResult.state === RunnableState.FAILED && (
          <div>
            <p>Error</p>
            <pre>{JSON.stringify(loginResult.error, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
}

