import { useMemo, useRef } from "react";

export function useTrackedKey(){
  const keys = useRef(new Map<string, number>());
  const counter = useRef(0);
  return useMemo(()=>{
    const tracker = {
      findOrCreate(path: string){
        if(!keys.current.has(path)){
          keys.current.set(path, counter.current++);
        }
        return keys.current.get(path)!;
      },
      update(oldPath: string, newPath: string){
        const key = keys.current.get(oldPath);
        keys.current.delete(oldPath);
        if(key) keys.current.set(newPath, key);
      },
      delete(path: string){
        keys.current.delete(path);
      },
      sortKeys(a: string, b: string){
        const aKey = tracker.findOrCreate(a);
        const bKey = tracker.findOrCreate(b);
        return aKey - bKey;
      },
      sortEntries(a: [string, any], b: [string, any]){
        const aKey = tracker.findOrCreate(a[0]);
        const bKey = tracker.findOrCreate(b[0]);
        return aKey - bKey;
      }
    }
    return tracker;
  }, [])
}
