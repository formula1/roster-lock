
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not defined`);
  return value;
}

const PUBLIC_RELAY_SERVER_URL = getEnv("PUBLIC_RELAY_SERVER_URL");
const RELAY_SERVER_URL = getEnv("RELAY_SERVER_URL");
const GAME_SERVER_URL = getEnv("GAME_SERVER_URL");


import { LinkedList } from './utils/LinkedList';

type User = {
  userId: string;
  publicKey: string;
  displayName: string;
}

export type QueuedUser = (
  & User
  & {
    rosterConfigHash: string;
    rosterConfig: any;
  }
);

type StoredUser = (
  & QueuedUser
  & {
    timestamp: number;
    timeout: NodeJS.Timeout;
  }
);

type MatchInfo = {
  users: Array<User>;
  rosterConfig: any;
  rosterConfigHash: string;
};

type Match = {
  matchId: string;
  users: Array<User>;
  rosterConfig: any;
  rosterConfigHash: string;
  roomStatus: (
    | { success: true, roomId: string, url: string }
    | { success: false, reason: string }
  )
  timeout: NodeJS.Timeout;
};

type RosterHash = string;
export class MatchmakingQueue {
  public totalUsers = 0;
  private queue: Map<RosterHash, LinkedList<StoredUser>> = new Map();
  private matches: Map<RosterHash, Array<Match>> = new Map();


  getUserQueue(hash: RosterHash) {
    const list = this.queue.get(hash);
    if(list) return list;
    const newList = new LinkedList<StoredUser>();
    this.queue.set(hash, newList);
    return newList;
  }

  join(user: QueuedUser) {
    const list = this.getUserQueue(user.rosterConfigHash);
    for(const node of list) {
      if(node.publicKey === user.publicKey) {
        throw new Error("User already in queue");
      }
    }
    const storedUser = {
      ...user,
      timestamp: Date.now(),
      timeout: setTimeout(() => {
        this.leave(user.publicKey, user.rosterConfigHash);
      }, 60 * 1000)
    };
    list.push(storedUser);
    this.totalUsers++;
    Promise.resolve().then(async ()=>{
      await this.tryToMakeMatch(user.rosterConfigHash);
    });
    return storedUser;
  }

  checkForMatch(publicKey: string, rosterConfigHash: RosterHash) {
    const list = this.getUserQueue(rosterConfigHash);
    for(const match of this.matches.get(rosterConfigHash) ?? []) {
      for(const user of match.users) {
        if(user.publicKey === publicKey) {
          match.timeout = setTimeout(() => {
            this.staleMatch(rosterConfigHash, match.matchId);
          }, 60 * 1000);
          clearTimeout(match.timeout);
          return match.roomStatus;
        }
      }
    }
    for(const node of list) {
      if(node.publicKey === publicKey) {
        clearTimeout(node.timeout);
        node.timeout = setTimeout(() => {
          this.leave(publicKey, rosterConfigHash);
        }, 60 * 1000);
        return null;
      }
    }
    return null;
  }

  leave(publicKey: string, rosterConfigHash: RosterHash) {
    const list = this.getUserQueue(rosterConfigHash);
    let index = 0;
    for(const node of list) {
      if(node.publicKey !== publicKey) {
        index++;
        continue;
      }
      list.remove(index);
      clearTimeout(node.timeout);
      this.totalUsers--;
      return true;
    }
    return false;
  }

  async tryToMakeMatch(hash: RosterHash) {
    const list = this.queue.get(hash);
    if (!list || list.length < 2) {
      return null;
    }
    const user1 = list.shift()!;
    const user2 = list.shift()!;
    this.totalUsers -= 2;
    const match = {
      users: [user1, user2].map(u => ({
        userId: u.userId,
        publicKey: u.publicKey,
        displayName: u.displayName
      })),
      rosterConfig: user1.rosterConfig,
      rosterConfigHash: user1.rosterConfigHash
    };
    try {
      const room = await createMatch(match);

      const matchObj = {
        ...match,
        matchId: crypto.randomUUID(),
        roomStatus: {
          success: true as true,
          roomId: room.roomId,
          url: PUBLIC_RELAY_SERVER_URL
        },
        timeout: setTimeout(() => {
          this.staleMatch(hash, room.roomId);
        }, 60 * 1000)
      };
      const matchList = this.matches.get(hash) || [];
      matchList.push(matchObj);
      this.matches.set(hash, matchList);
      return matchObj;
    }catch(e){
      console.log("Failed To Create Match", e);
      const matchObj = {
        ...match,
        matchId: crypto.randomUUID(),
        roomStatus: {
          success: false as false,
          reason: (e as Error).message
        },
        timeout: setTimeout(() => {
          this.staleMatch(hash, matchObj.matchId);
        }, 60 * 1000)
      };
      const matchList = this.matches.get(hash) || [];
      matchList.push(matchObj);
      this.matches.set(hash, matchList);
      return matchObj;
    }
  }

  async staleMatch(rosterHash: string, matchId: string) {
    let index = 0;
    for(const match of (this.matches.get(rosterHash) || [])){
      if(match.matchId !== matchId) {
        index++;
        continue;
      }
      this.matches.get(rosterHash)!.splice(index, 1);
      return true;
    }
    return false;
  }
}



import { CreateRoomBody } from './types';
import { signMessage } from './utils/crypto';
import { getSignatureKeys } from './globals/signature-keys';
async function createMatch(match: MatchInfo){
  const { publicKey, secretKey } = await getSignatureKeys();
  const webhooks = {
    onRoomComplete: `${GAME_SERVER_URL}/webhooks/room-complete`,
  };
  const signiture = await signMessage({
    service: 'create-room',
    publicKey: publicKey,
    rosterConfigHash: match.rosterConfigHash,
    users: match.users,
    webhooks: webhooks,
  }, secretKey);


  const relayRoomResponse = await fetch(`${RELAY_SERVER_URL}/api/v1/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...match,
      webhooks,
      publicKey: publicKey,
      signature: signiture,
    } satisfies CreateRoomBody)
  });

  if (!relayRoomResponse.ok) {
    // If relay room creation fails, we should clean up the game session
    // For now, just log the error
    console.error(`Failed to create relay room: ${relayRoomResponse.statusText}`);
    throw new Error(`Failed to create relay room: ${relayRoomResponse.statusText}`);
  }

  const relayRoom = await relayRoomResponse.json() as { roomId: string };
  console.log(`Relay room created: ${relayRoom.roomId}`);
  return relayRoom;
}
