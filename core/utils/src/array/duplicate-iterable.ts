import { LinkedList } from "./LinkedList";

export function duplicateIterable<T>(iterable: AsyncIterable<T> | Iterable<T>, numberOfTimes: number){
  if(numberOfTimes === 0) throw new Error("Number of Iterables should be at least 1")

  const streams: Array<BackPressureStream<T>> = []
  for(let i = 0; i < numberOfTimes; i++){
    streams.push(new BackPressureStream());
  }

  return {
    streams, start: async ()=>{
      try {
        for await (const item of iterable){
          for(const stream of streams){
            stream.push(item)
          }
        }
        for(const stream of streams){
          stream.end()
        }
      }catch(e){
        for(const stream of streams){
          stream.fail(e);
        }
      }
    }
  }

}

export class BackPressureStream<T> {
  buffer: LinkedList<T> = new LinkedList();
  finished: null | { success: true } | { success: false, error: any } = null;
  waiting: null | (()=>any) = null;
  push(newItem: T){
    if(this.finished) throw new Error("Already Closed")
    this.buffer.push(newItem);
    this.#restartLoop();
  }
  end(){
    if(this.finished) throw new Error("Already Closed")
    this.finished = { success: true }
    this.#restartLoop();
  }
  fail(error: any){
    if(this.finished) throw new Error("Already Closed")
    this.finished = { success: false, error }
    this.#restartLoop()
  }
  #restartLoop(){
    if(!this.waiting) return;
    const waiting = this.waiting
    this.waiting = null
    waiting();
  }
  async *[Symbol.asyncIterator]() {
    while(!this.finished || this.buffer.length){
      while(this.buffer.length){
        yield this.buffer.shift()
      }
      if(this.finished) break;
      await new Promise<void>((res)=>{
        this.waiting = res;
      })
    }
    if(!this.finished.success){
      throw this.finished.error
    }
  }
}
