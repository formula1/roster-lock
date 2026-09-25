
import { useCallback, useEffect, useState } from "react";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user";
import { usePromisedMemo } from "../../utils/promised-memo";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { Forbidden } from "../error/forbidden";
import { useParams } from "react-router-dom";

export function GameCoordinatorItem() {
  const { gameCoordinatorId } = useParams();
  if(!gameCoordinatorId) throw new Error("gameCoordinatorId is required");
  const { user } = useUser();
  const gameCoordinator = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.gameCoordinator.get({ authToken: user.token }, { gameCoordinatorId });
  }, [user, gameCoordinatorId]);

  const refresh = useCallback(async ()=>{
    await gameCoordinator.update();
  }, [gameCoordinator]);

  if(!user) return <Forbidden />;
  if(gameCoordinator.status === "not-run") return null;
  if(gameCoordinator.status === "pending") return <div>Loading...</div>;
  if(gameCoordinator.status === "failed"){
    return <div>
      <div>Error <button onClick={refresh}>Retry</button></div>
      <pre>{JSON.stringify(gameCoordinator.error, null, 2)}</pre>
    </div>;
  }

  return (
    <div>
      <h1>Game Coordinator</h1>
      <div>
        <GameCoordinatorInfo gameCoordinator={gameCoordinator.value} update={refresh} />
        <div>Registered At: {gameCoordinator.value.registered_at}</div>
        <div>Updated At: {gameCoordinator.value.updated_at}</div>
      </div>
    </div>
  );
}

function GameCoordinatorInfo(
  { gameCoordinator, update }: {
    gameCoordinator: Awaited<ReturnType<typeof RELAY_API.gameCoordinator.get>>,
    update: ()=>void
  }
){
  const { user } = useUser();
  const [name, setName] = useState(gameCoordinator.name);
  const [successWebhookUrl, setSuccessWebhookUrl] = useState(gameCoordinator.success_webhook_url);
  const [failureWebhookUrl, setFailureWebhookUrl] = useState(gameCoordinator.failure_webhook_url);

  useEffect(()=>{
    setName(gameCoordinator.name);
    setSuccessWebhookUrl(gameCoordinator.success_webhook_url);
    setFailureWebhookUrl(gameCoordinator.failure_webhook_url);
  }, [gameCoordinator])

  const saveResult = useRunnable(useCallback(async ()=>{
    if(!user) throw new Error("Not logged in");
    await RELAY_API.gameCoordinator.update(
      { authToken: user.token },
      { gameCoordinatorId: gameCoordinator.id },
      { name, successWebhookUrl, failureWebhookUrl }
    );
    update();
  }, [user, gameCoordinator, name, successWebhookUrl, failureWebhookUrl]));

  const toggleResult = useRunnable(useCallback(async ()=>{
    if(!user) throw new Error("Not logged in");
    if(gameCoordinator.status === 'active'){
      await RELAY_API.gameCoordinator.suspend({ authToken: user.token }, { gameCoordinatorId: gameCoordinator.id });
    } else {
      await RELAY_API.gameCoordinator.activate({ authToken: user.token }, { gameCoordinatorId: gameCoordinator.id });
    }
    update();
  }, [user, gameCoordinator]));

  const hasChanged = (
    name !== gameCoordinator.name ||
    successWebhookUrl !== gameCoordinator.success_webhook_url ||
    failureWebhookUrl !== gameCoordinator.failure_webhook_url
  );

  if(!user) return null;

  return (
    <>
      <div>
        <button
          onClick={saveResult.run}
          disabled={
            saveResult.state === RunnableState.PENDING || !hasChanged
          }
        >Save</button>
      </div>
      <div>
        Name <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        Success Webhook URL <input
          type="text"
          value={successWebhookUrl}
          onChange={(e) => setSuccessWebhookUrl(e.target.value)}
        />
      </div>
      <div>
        Failure Webhook URL <input
          type="text"
          value={failureWebhookUrl}
          onChange={(e) => setFailureWebhookUrl(e.target.value)}
        />
      </div>
      <div>API Key: {gameCoordinator.api_key_preview}</div>
      <div>
        <div
          style={{ color: gameCoordinator.status === 'active' ? 'green' : 'red' }}
        >Status: {gameCoordinator.status}</div>
        {
          toggleResult.state === RunnableState.PENDING ? (
            <button disabled>Pending...</button>
          ) : gameCoordinator.status === 'active' ? (
            <button
              style={{ backgroundColor: 'red', color: 'white' }}
              onClick={toggleResult.run}
            >Suspend</button>
          ) : (
            <button
              style={{ backgroundColor: 'green', color: 'white' }}
              onClick={toggleResult.run}
            >Activate</button>
          )
        }
      </div>
    </>
  )
}
