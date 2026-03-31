
import { useCallback, useEffect, useState } from "react";
import { RELAY_API } from "../../globals/api";
import { useUser } from "../../globals/user";
import { usePromisedMemo } from "../../utils/promised-memo";
import { RunnableState, useRunnable } from "../../utils/runnable";
import { Forbidden } from "../error/forbidden";
import { useParams } from "react-router-dom";

export function MatchMakerItem() {
  const { matchMakerId } = useParams();
  if(!matchMakerId) throw new Error("matchMakerId is required");
  const { user } = useUser();
  const matchMaker = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.matchmaker.get({ authToken: user.token }, { matchMakerId });
  }, [user, matchMakerId]);
  const stats = usePromisedMemo(!user ? null : async ()=>{
    return RELAY_API.matchmaker.stats({ authToken: user.token }, { matchMakerId });
  }, [user, matchMakerId]);

  const refresh = useCallback(async ()=>{
    await Promise.all([
      matchMaker.update(),
      stats.update(),
    ])
  }, [matchMaker, stats]);

  if(!user) return <Forbidden />;
  if(matchMaker.status === "not-run" || stats.status === "not-run") return null;
  if(matchMaker.status === "pending" || stats.status === "pending") return <div>Loading...</div>;
  if(matchMaker.status === "failed"){
    return <div>
      <div>Error <button onClick={refresh}>Retry</button></div>
      <pre>{JSON.stringify(matchMaker.error, null, 2)}</pre>
    </div>;
  }
  if(stats.status === "failed"){
    return <div>
      <div>Error <button onClick={refresh}>Retry</button></div>
      <pre>{JSON.stringify(stats.error, null, 2)}</pre>
    </div>;
  }

  return (
    <div>
      <h1>Match Maker</h1>
      <div>
        <MatchMakerInfo matchMaker={matchMaker.value} update={refresh} />
        <div>Registered At: {matchMaker.value.registered_at}</div>
        <div>Updated At: {matchMaker.value.updated_at}</div>
      </div>
      <div>
        <h2>Stats <button onClick={stats.update}>Refresh</button></h2>
        <div>Total Rooms: {stats.value.total_rooms}</div>
        <div>Active Rooms: {stats.value.active_rooms}</div>
        <div>Successful Rooms: {stats.value.successful_rooms}</div>
        <div>Failed Rooms: {stats.value.failed_rooms}</div>
        <div>Avg Lifetime: {stats.value.avg_lifetime_seconds} seconds</div>
      </div>
    </div>
  );
}

function MatchMakerInfo(
  { matchMaker, update }: {
    matchMaker: Awaited<ReturnType<typeof RELAY_API.matchmaker.get>>,
    update: ()=>void
  }
){
  const { user } = useUser();
  const [name, setName] = useState(matchMaker.name);
  const [publicKey, setPublicKey] = useState(matchMaker.public_key);

  useEffect(()=>{
    setName(matchMaker.name);
    setPublicKey(matchMaker.public_key);
  }, [matchMaker])

  const saveResult = useRunnable(async ()=>{
    if(!user) throw new Error("Not logged in");
    await RELAY_API.matchmaker.update(
      { authToken: user.token }, { matchMakerId: matchMaker.id }, { name, publicKey }
    );
    update();
  })

  const toggleResult = useRunnable(async ()=>{
    if(!user) throw new Error("Not logged in");
    if(matchMaker.status === 'active'){
      await RELAY_API.matchmaker.suspend({ authToken: user.token }, { matchMakerId: matchMaker.id });
    } else {
      await RELAY_API.matchmaker.activate({ authToken: user.token }, { matchMakerId: matchMaker.id });
    }
    update();
  })

  const hasChanged = (
    name !== matchMaker.name ||
    publicKey !== matchMaker.public_key
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
        Public Key <input
          type="text"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
        />
      </div>
      <div>
        <div
          style={{ color: matchMaker.status === 'active' ? 'green' : 'red' }}
        >Status: {matchMaker.status}</div>
        {
          toggleResult.state === RunnableState.PENDING ? (
            <button disabled>Pending...</button>
          ) : matchMaker.status === 'active' ? (
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
