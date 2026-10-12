import { DurableObjectTransaction } from "@cloudflare/workers-types"

const TIMEOUT_KEY = "room-to";
type Timeout = { id: string, timestamp: number, fn: { id: string, args: Record<string, any> } };
export type TimeoutInput = { id: string, offset: number, fn: Timeout["fn"] };
type StoredTimeoutInfo = { nextTimeout: number, timeouts: Array<Timeout> };

export const TIMEOUT_CONTROLLER = {
  async addTimeouts(txc: DurableObjectTransaction, tos: Array<TimeoutInput>){
    if(tos.length === 0) return;
    const now = Date.now();
    const result = await getOrDefault(txc);
    let shouldTrigger = result.timeouts.length === 0;
    for(const { id, offset, fn } of tos){
      const timestamp = now + offset;
      result.timeouts.push({ id, timestamp, fn });
      if(result.nextTimeout > timestamp){
        shouldTrigger = true;
        result.nextTimeout = timestamp;
      }
    }
    await txc.put(TIMEOUT_KEY, result);
    if(shouldTrigger){
      await txc.setAlarm(result.nextTimeout)
    }
  },
  async cancelTimeout(txc: DurableObjectTransaction, id: string){
    const result = await getOrDefault(txc);
    let found = false;
    const oldTimeout = result.nextTimeout;
    result.nextTimeout = Number.POSITIVE_INFINITY;
    const filtered: Array<Timeout> = []
    for(const active of result.timeouts){
      if(active.id === id){
        found = true;
        continue;
      }
      // If the active will end sooner than another
      // that should set the next alarm
      if(active.timestamp < result.nextTimeout){
        result.nextTimeout = active.timestamp;
      }
      filtered.push(active);
    }
    result.timeouts = filtered;
    await txc.put(TIMEOUT_KEY, result);
    if(oldTimeout !== result.nextTimeout){
      await txc.setAlarm(result.nextTimeout)
    }
    return found
  },
  async handleTimeout(txc: DurableObjectTransaction){
    const result = await getOrDefault(txc);
    const now = Date.now();
    result.nextTimeout = Number.POSITIVE_INFINITY;
    const activeFns: Array<Timeout["fn"]> = []; 
    const savedFns: Array<Timeout> = [];
    for(const active of result.timeouts){
      // If the timeout is active, run it
      if(active.timestamp <= now){
        activeFns.push(active.fn)
        continue;
      }
      // If the active will end sooner than another
      // that should set the next alarm
      if(active.timestamp < result.nextTimeout){
        result.nextTimeout = active.timestamp;
      }
      // save anything thats no longer active
      savedFns.push(active)
    }
    result.timeouts = savedFns;
    if(savedFns.length === 0){
      await txc.delete(TIMEOUT_KEY);
    } else {
      await txc.put(TIMEOUT_KEY, result);
    }
    if(result.nextTimeout < Number.POSITIVE_INFINITY){
      await txc.setAlarm(result.nextTimeout)
    }
    return activeFns;
  }
}

async function getOrDefault(txc: DurableObjectTransaction){
  return (
    await txc.get(TIMEOUT_KEY) as StoredTimeoutInfo ||
    { nextTimeout: Number.POSITIVE_INFINITY, timeouts: [] }
  );
}