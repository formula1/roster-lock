import { Link } from "react-router-dom";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user"
import { replaceParams } from "../../utils/fetch";
import { usePromisedMemo } from "../../utils/promised-memo";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { Forbidden } from "../error/forbidden";
import { GameCoordinatorPaths } from "./paths";
import { useCallback, useState } from "react";
import { ValidatedTextInput } from "../../components/ValidatedTextInput";


export function GameCoordinators(){
  const { user } = useUser();

  const gameCoordinators = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.gameCoordinator.list({ authToken: user.token });
  }, [user]);

  if(!user) return <Forbidden />;

  return (
    <div>
      <h1>Game Coordinators</h1>
      {(()=>{
        switch(gameCoordinators.status){
          case "not-run": return <div>Loading...</div>;
          case "pending": return <div>Loading...</div>;
          case "failed": return (
            <div>
              <div>Error</div>
              <pre>{JSON.stringify(gameCoordinators.error, null, 2)}</pre>
            </div>
          );
          case "success": return (
            <>
              <CreateForm
                items={gameCoordinators.value}
                update={gameCoordinators.update}
              />
              <GameCoordinatorList
                gameCoordinators={gameCoordinators.value}
              />
            </>
          );
        }
      })()}
    </div>
  )
}

function CreateForm({ items, update }: { items: Array<GameCoordinator>, update: ()=>void }){
  const { user } = useUser();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [successWebhookUrl, setSuccessWebhookUrl] = useState('');
  const [failureWebhookUrl, setFailureWebhookUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const createResult = useRunnable(useCallback(async ()=>{
    if(!user) throw new Error("Not logged in");
    await RELAY_API.gameCoordinator.create(
      { authToken: user.token },
      { id, name, successWebhookUrl, failureWebhookUrl, apiKey }
    );
    update();
    setId('');
    setName('');
    setSuccessWebhookUrl('');
    setFailureWebhookUrl('');
    setApiKey('');
  }, [user, id, name, successWebhookUrl, failureWebhookUrl, apiKey]));

  return (
    <div>
      <h2>Create Game Coordinator</h2>
      <form
        onSubmit={async (e)=>{
          e.preventDefault();
          createResult.run();
        }}
      >
        <ValidatedTextInput
          title="Id"
          value={id}
          onChange={setId}
          validate={(v) => {
            if(v === "") throw new Error("Id cannot be empty");
            if(items.find((item) => item.id === v)) throw new Error("Id already exists");
          }}
        />
        <ValidatedTextInput
          title="Name"
          value={name}
          onChange={setName}
          validate={(v) => {
            if(v === "") throw new Error("Name cannot be empty");
          }}
        />
        <ValidatedTextInput
          title="Success Webhook URL"
          value={successWebhookUrl}
          onChange={setSuccessWebhookUrl}
          validate={(v) => {
            if(v === "") throw new Error("Success Webhook URL cannot be empty");
          }}
        />
        <ValidatedTextInput
          title="Failure Webhook URL"
          value={failureWebhookUrl}
          onChange={setFailureWebhookUrl}
          validate={(v) => {
            if(v === "") throw new Error("Failure Webhook URL cannot be empty");
          }}
        />
        <ValidatedTextInput
          title="API Key"
          value={apiKey}
          onChange={setApiKey}
          validate={(v) => {
            if(v.length < 32) throw new Error("API Key must be at least 32 characters");
          }}
        />
        <button
          type="submit"
          disabled={createResult.state === RunnableState.PENDING}
        >Create</button>
      </form>
    </div>
  )
}

type GameCoordinator = Awaited<ReturnType<typeof RELAY_API.gameCoordinator.list>>[number];

function GameCoordinatorList({ gameCoordinators }: {
  gameCoordinators: Awaited<ReturnType<typeof RELAY_API.gameCoordinator.list>>
}){
  return (
    <table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Name</th>
          <th>Status</th>
          <th>Registered At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {gameCoordinators.map((gameCoordinator) => (
          <tr key={gameCoordinator.id}>
            <td>{gameCoordinator.id}</td>
            <td>{gameCoordinator.name}</td>
            <td>{gameCoordinator.status}</td>
            <td>{gameCoordinator.registered_at}</td>
            <td>
              <Link to={replaceParams(GameCoordinatorPaths.item, { gameCoordinatorId: gameCoordinator.id })}>
                View
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
