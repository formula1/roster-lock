import { useNavigate, useParams } from "react-router-dom";
import { RELAY_API } from "../../globals/api";
import { usePromisedMemo } from "../../utils/promised-memo";
import { useUser } from "../../globals/user";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { UsersPaths } from "./paths";



export function UserItem() {
  const { username } = useParams();
  if(!username) throw new Error("username is required");
  const { user: authUser } = useUser();
  const user = usePromisedMemo(!authUser ? null : async ()=>{
    return RELAY_API.users.get({ authToken: authUser.token }, { username });
  }, [authUser, username]);

  if(!authUser) return null;
  if(user.status === "not-run") return null;
  if(user.status === "pending") return <div>Loading...</div>;
  if(user.status === "failed"){
    return <div>
      <div>Error <button onClick={user.update}>Retry</button></div>
      <pre>{JSON.stringify(user.error, null, 2)}</pre>
    </div>;
  }

  return (
    <div>
        <h1>User Item</h1>
        <div>Username: {user.value.username}</div>
        <div>Password Expires At: {user.value.password_expires_at}</div>
        <div>Created At: {user.value.created_at}</div>
        <div>Updated At: {user.value.updated_at}</div>
        <ResetPasswordForm username={username} />
        <DeleteUserForm username={username} />

    </div>
  );
}

function ResetPasswordForm({ username }: { username: string }){
  const { user: authUser } = useUser();
  const resetResult = useRunnable(async ()=>{
    if(!authUser) throw new Error("Not logged in");
    return RELAY_API.users.reset({ authToken: authUser.token }, { username });
  })

  return (
    <div>
      <div>
        <button
          type="submit"
          disabled={resetResult.state === RunnableState.PENDING}
          onClick={resetResult.run}
        >Reset Password</button>
      </div>
      {resetResult.state === RunnableState.FAILED && (
        <div>
          <div>Error</div>
          <pre>{JSON.stringify(resetResult.error, null, 2)}</pre>
        </div>
      )}
      {resetResult.state === RunnableState.SUCCESS && (
        <div>
          <div>Success</div>
          <div>Temporary Password: {resetResult.value.temporaryPassword}</div>
          <div>Expires At: {resetResult.value.expiresAt}</div>
        </div>
      )}
    </div>
  );
}


function DeleteUserForm({ username }: { username: string }) {
  const { user: authUser } = useUser();
  const navigate = useNavigate();
  const deleteResult = useRunnable(async ()=>{
    if(!authUser) throw new Error("Not logged in");
    await RELAY_API.users.delete({ authToken: authUser.token }, { username });
    navigate(UsersPaths.root);
  })

  return (
    <div>
      <button
        type="submit"
        disabled={deleteResult.state === RunnableState.PENDING}
        onClick={deleteResult.run}
      >Delete User</button>
    </div>
  );
}
