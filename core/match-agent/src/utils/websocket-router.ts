
import { IncomingMessage } from "http";
import { match } from "path-to-regexp";
import { WebSocket } from "ws";

type Matcher = ReturnType<typeof match>;

type RouterConfig = { mergeParams?: boolean };

type RouteInfo = {
  url: URL,
  params: Record<string, string>,
}

export type WSRequest = WebSocket & { httpRequest: IncomingMessage };

export type WebSocketHandlerCallback = (request: WSRequest, params: RouteInfo, callback: (err?: any)=>void)=>void;
export class WebSocketRouter {
  handlers: Array<{
    path: string,
    matcher: Matcher,
    callbacks: Array<WebSocketHandlerCallback>,
    isPrefix: boolean,
  }> = [];
  constructor(private config: RouterConfig  = {}){
    this.handlers = [];
  }
  use(path: string, ...callbacks: Array<WebSocketRouter | WebSocketHandlerCallback>){
    return this.addHandler(path, true, ...callbacks);
  }
  mount(path: string, ...callbacks: Array<WebSocketRouter | WebSocketHandlerCallback>){
    return this.addHandler(path, false, ...callbacks);
  }
  private addHandler(path: string, isPrefix: boolean, ...callbacks: Array<WebSocketRouter | WebSocketHandlerCallback>){
    const matcher = match(path, { end: !isPrefix, decode: decodeURIComponent });
    const realCallbacks: Array<WebSocketHandlerCallback> = callbacks.map((callback)=>(
      (callback instanceof WebSocketRouter) ? (request, params, cb)=>(callback.handleRequest(request, cb, params)) :
      callback
    ));
    this.handlers.push({
      path: path,
      matcher: matcher,
      callbacks: realCallbacks,
      isPrefix: isPrefix,
    });
    return this;
  }
  handleRequest(request: WSRequest, callback: (err?: any)=>void, parentRoute?: RouteInfo){
    if(!parentRoute){
      parentRoute = {
        url: new URL(request.url, "ws://localhost:80"),
        params: {},
      }
    } else {
      parentRoute = {
        url: new URL(parentRoute.url),
        params: !this.config.mergeParams ? {} : { ...parentRoute.params },
      }
    }

    const pathname = parentRoute.url.pathname;
    if(pathname === null){
      Promise.resolve(new Error("no pathname in request")).then(callback);
      return;
    }

    eachSeries(this.handlers, (handler, nextHandler)=>{
      const matchResult = handler.matcher(pathname);
      if(matchResult === false) return nextHandler();

      const { params, path: matchedPath } = matchResult;

      const nextInfo: RouteInfo = {
        url: new URL(parentRoute.url.toString()),
        params: { ...parentRoute.params, ...(params as Record<string, string>) },
      };

      if(handler.isPrefix){
        nextInfo.url.pathname = nextInfo.url.pathname.slice(matchedPath.length) || "/";
      }

      eachSeries(handler.callbacks, (fn, nextFn)=>{
        fn(request, nextInfo, nextFn);
      }, nextHandler);
    }, callback);
  }
}

function eachSeries<T>(
  values: Array<T>,
  iterator: (value: T, next: (err?: any)=>void)=>void,
  finishedCB: (err?: any)=>void
){
  let index = 0;
  function next(err?: any){
    if(err) return finishedCB(err);
    if(index >= values.length) return finishedCB();
    iterator(values[index++], next);
  }
  next();
}