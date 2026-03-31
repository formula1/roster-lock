
import { ProgressHandlers } from "../../../handleDownloads/types";

export class MultiAbortSignal {
  private abortController = new AbortController();
  private handlers = new Map<ProgressHandlers, ()=>void>();
  get abortSignal(){
    return this.abortController.signal;
  }

  constructor(signals: ProgressHandlers[] = []){
    for(const signal of signals){
      this.addSignal(signal);
    }
  }

  emitEvent(
    event: Parameters<ProgressHandlers["onProgress"]>[0]
  ){
    for(const handler of this.handlers.keys()){
      try {
        handler.onProgress(event);
      }catch(e){
        console.error("Error Emitting Event", e);
      }
    }
  }

  addSignal(newHandler: ProgressHandlers){
    if(this.abortController.signal.aborted) return;
    if(newHandler.abortSignal.aborted) return;
    if(this.handlers.has(newHandler)) return;
    const listener = ()=>{
      this.removeSignal(newHandler);
      if(this.handlers.size === 0) this.abort();
    };
    this.handlers.set(newHandler, listener);
    newHandler.abortSignal.addEventListener("abort", listener);
  }
  removeSignal(oldHandler: ProgressHandlers){
    const listener = this.handlers.get(oldHandler);
    if(!listener) return;
    oldHandler.abortSignal.removeEventListener("abort", listener);
    this.handlers.delete(oldHandler);
  }
  clear(){
    for(const [handler, listener] of this.handlers.entries()) {
      handler.abortSignal.removeEventListener("abort", listener);
    }
    this.handlers.clear();
  }
  abort(){
    this.clear();
    this.abortController.abort();
  }
}

export async function raceWithAbort<T>(
  promise: Promise<T>,
  abortSignal: AbortSignal
): Promise<T> {
  if(abortSignal.aborted) throw new Error('Download aborted by caller');

  const { promise: abortPromise, reject } = Promise.withResolvers<T>();

  const listener = ()=>{
    reject(new Error('Download aborted by caller'));
  }

  abortSignal.addEventListener("abort", listener, { once: true });
 
  promise.finally(()=>{
    abortSignal.removeEventListener("abort", listener);
  });

  return Promise.race([
    promise,
    abortPromise
  ]);
}

