import { Link } from "react-router-dom";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user"
import { replaceParams } from "../../utils/fetch";
import { usePromisedMemo } from "../../utils/promised-memo";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { Forbidden } from "../error/forbidden";
import { MatchMakerPaths } from "./paths";
import { useState } from "react";
import { ValidatedTextInput } from "../../components/ValidatedTextInput";


export function MatchMakers(){
  const { user } = useUser();

  const matchMakers = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.matchmaker.list({ authToken: user.token });
  }, [user]);

  if(!user) return <Forbidden />;

  return (
    <div>
      <h1>Match Makers</h1>
      {(()=>{
        switch(matchMakers.status){
          case "not-run": return <div>Loading...</div>;
          case "pending": return <div>Loading...</div>;
          case "failed": return (
            <div>
              <div>Error</div>
              <pre>{JSON.stringify(matchMakers.error, null, 2)}</pre>
            </div>
          );
          case "success": return (
            <>
              <CreateForm
                items={matchMakers.value}
                update={matchMakers.update}
              />
              <MatchMakerList
                matchMakers={matchMakers.value}
                updateMatchMakers={matchMakers.update}
              />
            </>
          );
        }
      })()}
    </div>
  )
}

function CreateForm({ items, update }: { items: Array<MatchMaker>, update: ()=>void }){
  const { user } = useUser();
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');

  const createResult = useRunnable(async ()=>{
    if(!user) throw new Error("Not logged in");
    await RELAY_API.matchmaker.create({ authToken: user.token }, { name, publicKey });
    update();
    setName('');
    setPublicKey('');
  })

  return (
    <div>
      <h2>Create Match Maker</h2>
      <form
        onSubmit={async (e)=>{
          e.preventDefault();
          createResult.run();
        }}
      >
        <ValidatedTextInput
          title="Name"
          value={name}
          onChange={setName}
          validate={(v) => {
            if(v === "") throw new Error("Name cannot be empty");
            if(items.find((item) => item.name === v)) throw new Error("Name already exists");
          }}
        />
        <ValidatedTextInput
          title="Public Key"
          value={publicKey}
          onChange={setPublicKey}
          validate={(v) => {
            if(v === "") throw new Error("Public Key cannot be empty");
            if(items.find((item) => item.public_key === v)) throw new Error("Public Key already exists");
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


type MatchMaker = Awaited<ReturnType<typeof RELAY_API.matchmaker.list>>[number];

function MatchMakerList({ matchMakers, updateMatchMakers }: {
  matchMakers: Awaited<ReturnType<typeof RELAY_API.matchmaker.list>>
  updateMatchMakers: ()=>void
}){
  const { user } = useUser();
  const toggleResult = useRunnable(async (matchMaker: MatchMaker)=>{
    if(!user) throw new Error("Not logged in");
    if(matchMaker.status === 'active'){
      await RELAY_API.matchmaker.suspend({ authToken: user.token }, { matchMakerId: matchMaker.id });
    } else {
      await RELAY_API.matchmaker.activate({ authToken: user.token }, { matchMakerId: matchMaker.id });
    };
    updateMatchMakers();
  })
  
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Public Key</th>
          <th>Registered At</th>
          <th>Status</th>
          <th>Updated At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {matchMakers.map((matchMaker) => (
          <tr>
            <td>{matchMaker.name}</td>
            <td>{matchMaker.public_key}</td>
            <td>{matchMaker.registered_at}</td>
            <td>{matchMaker.status}</td>
            <td>{matchMaker.updated_at}</td>
            <td>
              <div>
                <Link to={replaceParams(MatchMakerPaths.item, { matchMakerId: matchMaker.id })}>
                  View
                </Link>
              </div>
              <div>
                <button
                  disabled={toggleResult.state === RunnableState.PENDING}
                  onClick={async ()=>{ toggleResult.run(matchMaker); }}
                >{matchMaker.status === 'active' ? 'Suspend' : 'Activate'}</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

}
