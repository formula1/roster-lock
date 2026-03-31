import { useState } from "react";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user";
import { usePromisedMemo } from "../../utils/promised-memo";
import { useRunnable } from "../../utils/runnable";

export function Self() {
  const { user } = useUser();
  const selfResult = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.auth.me({ authToken: user.token });
  }, [user]);

  if(!user) return null;
  if(selfResult.status === "not-run") return null;
  if(selfResult.status === "pending") return <div>Loading...</div>;
  if(selfResult.status === "failed"){
    return <div>
      <div>Error <button onClick={selfResult.update}>Retry</button></div>
      <pre>{JSON.stringify(selfResult.error, null, 2)}</pre>
    </div>;
  }

  return (
    <UserDisplay self={selfResult.value} update={selfResult.update} />
  );
}

function UserDisplay({ self }: {
  self: Awaited<ReturnType<typeof RELAY_API.auth.me>>,
  update: ()=>void
}){
  const { user } = useUser();
  const [password, setPassword] = useState('');
  const updateResult = useRunnable(async ()=>{
    if(!user) throw new Error("Not logged in");
    await RELAY_API.auth.updatePassword({ authToken: user.token }, { password });
  })

  return (
    <div>
      <h1>You</h1>
      <pre>{JSON.stringify(self, null, 2)}</pre>
      <form
        onSubmit={async (e)=>{
          e.preventDefault();
          updateResult.run();
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Update Password</button>
      </form>
    </div>
  )
}
