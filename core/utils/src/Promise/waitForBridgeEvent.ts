import { MessageBridge } from "../MessageBridge";
import { promiseWithResolvers } from "./withResolvers";

export function waitForBridgeEvent<T>(bridge: MessageBridge, event: string, timeout: number){
  const { resolve, reject, promise } = promiseWithResolvers();

  const to = setTimeout(()=>{
    reject(new Error("Timeout"));
  }, timeout);

  bridge.onEvent(event, (data)=>{
    resolve(data as T);
  });

  // promise.finally() returns its own derived promise that adopts the same
  // rejection - since that derived promise isn't returned or stored anywhere,
  // it's a second, floating unhandled-rejection source independent of what
  // the caller does with the returned `promise` below. Swallow it here.
  promise.finally(()=>{
    clearTimeout(to);
  }).catch(()=>{});

  return promise;
}
