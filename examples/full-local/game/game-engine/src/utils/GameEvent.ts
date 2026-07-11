
type ListenerSource = string;
type Listener<Args extends Array<any>> =  (...args: Args)=>void;
import { Random } from "./Random";

interface IGameEventEmitterContext<Args extends Array<any>> {
  random: Random
  config: {
    allowDuplicateCallback: boolean,
    maximumListeners: number,
    suppressErrors: boolean,
  }
  listeners: Array<{ source: ListenerSource, listener: Listener<Args> }>
}

export interface IGameEventEmitter<Args extends Array<any>> extends IGameEventEmitterContext<Args> {
  config: {
    allowDuplicateCallback: boolean,
    maximumListeners: number,
    suppressErrors: boolean,
  }
  listeners: Array<{ source: ListenerSource, listener: Listener<Args> }>
  (source: ListenerSource, cb: Listener<Args>): ()=>boolean
  onReturnOff(source: ListenerSource, cb: Listener<Args>): ()=>boolean

  on(source: ListenerSource, cb: Listener<Args>): void
  off(source: ListenerSource, cb: Listener<Args>): boolean
  emit(...args: Args): void
}

export function createGameEventEmitter<Args extends Array<any>>(
  random: Random,
  config = {
    allowDuplicateCallback: false,
    maximumListeners: Number.POSITIVE_INFINITY,
    suppressErrors: true,
  }
): IGameEventEmitter<Args>{

  if(config.maximumListeners <= 0){
    throw new Error("maximumListeners can't be less than or equal to 0");
  }

  const context: IGameEventEmitterContext<Args> = {
    random,
    config,
    listeners: [],
  }

  const emitter = GameEventEmitter.bind(context as IGameEventEmitter<Args>) as IGameEventEmitter<Args>;

  emitter.onReturnOff = emitter;
  emitter.on = addListener.bind(context as IGameEventEmitter<Args>);
  emitter.off = removeListener.bind(context as IGameEventEmitter<Args>);
  emitter.emit = emitEvent.bind(context as IGameEventEmitter<Args>);

  (context as any).on = emitter.on;
  (context as any).off = emitter.off;

  return emitter;
}

function GameEventEmitter<Args extends Array<any>>(
  this: IGameEventEmitter<Args>, source: ListenerSource, cb: Listener<Args>
){
  this.on(source, cb);
  return ()=>(this.off(source, cb));
}

function addListener<Args extends Array<any>>(
  this: IGameEventEmitter<Args>, source: ListenerSource, cb: Listener<Args>
){
  if(this.config.maximumListeners === this.listeners.length){
    throw new Error("Hit Maximum Listeners")
  }
  if(!this.config.allowDuplicateCallback){
    for(const { listener } of this.listeners){
      if(listener === cb){
        throw new Error("Can't add listener multiple times")
      }
    }
  }
  this.listeners.push({ source, listener: cb });
}

function removeListener<Args extends Array<any>>(
  this: IGameEventEmitter<Args>, source: ListenerSource, cb: Listener<Args>
){
  const offset = this.listeners.findIndex((l)=>{
    return l.source === source && l.listener === cb;
  });
  if(offset === -1){
    return false;
  }
  this.listeners.splice(offset, 1);
  return true;
}

function emitEvent<Args extends Array<any>>(
  this: IGameEventEmitter<Args>, ...args: Args
){
  const sortedListeners = this.listeners.sort((a, b)=>{
    return a.source.localeCompare(b.source);
  });
  const shuffledListeners = this.random.shuffleImmutable(sortedListeners);

  for(const { listener } of shuffledListeners){
    try {
      listener(...args);
    }catch(e){
      if(!this.config.suppressErrors) throw e;
    }
  }
}

