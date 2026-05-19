
export function getOrCreate<T>(create: ()=>T): ()=>T {
  let isReady: null | { result: 1, v: T } | { result: -1, e: any } = null;
  return ()=>{
    if(isReady === null){
      try {
        isReady = { result: 1, v: create() };
        return isReady.v;
      }catch(e){
        isReady = { result: -1, e };
        throw e;
      }
    }
    if(isReady.result === 1) return isReady.v;
    if(isReady.result === -1) return isReady.e
  }
}