
import { promiseWithResolvers } from "./withResolvers";
import { ISimpleEventEmitter } from "../SimpleEvent";
export function waitForEvent<Args extends Array<any>>(event: ISimpleEventEmitter<Args>, abortSignal?: AbortSignal){
  if(abortSignal?.aborted){
    return Promise.reject(new Error("Aborted"));
  }

  const { promise, resolve, reject } = promiseWithResolvers<Args>();
  const off = event(((...args: Args)=>{
    resolve(args);
  }));

  promise.finally(()=>{
    off();
  });

  if(abortSignal){
    abortSignal.addEventListener("abort", ()=>(
      reject(new Error("Aborted"))
    ));
  }
  return promise;
}

export function waitForEventTimeout(event: ISimpleEventEmitter<any[]>, timeout: number, abortSignal?: AbortSignal){
  if(abortSignal?.aborted){
    return Promise.reject(new Error("Aborted"));
  }

  const { promise, resolve, reject } = promiseWithResolvers<void>();
  const eventTimedOut = ()=>(resolve());

  let to = setTimeout(eventTimedOut, timeout);
  const off = event(((...args: any[])=>{
    clearTimeout(to);
    to = setTimeout(eventTimedOut, timeout);
  }));

  promise.finally(()=>{
    off(); clearTimeout(to);
  });

  if(abortSignal){
    abortSignal.addEventListener("abort", ()=>(
      reject(new Error("Aborted"))
    ));
  }

  return promise;
}
