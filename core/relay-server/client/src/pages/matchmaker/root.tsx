import { Link } from "react-router-dom";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user"
import { replaceParams } from "../../utils/fetch";
import { usePromisedMemo } from "../../utils/promised-memo";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { Forbidden } from "../error/forbidden";
import { MatchMakerPaths } from "./paths";


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
            <MatchMakerList
              matchMakers={matchMakers.value}
              updateMatchMakers={matchMakers.update}
            />
          );
        }
      })()}
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
