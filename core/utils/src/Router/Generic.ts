
import { match } from "path-to-regexp";
import { eachSeries } from "../async";

export type RouterConfig = { mergeParams?: boolean };

type Matcher = ReturnType<typeof match>;
type RouteInfo = {
  url: URL,
  params: Record<string, string>,
}

export type GenericHandlerCallback<RequestType> = (request: RequestType, params: RouteInfo, callback: (err?: any)=>void)=>any;
export type GenericRouterCallbackArg<RequestType> = (
  | GenericRouter<RequestType>
  | GenericHandlerCallback<RequestType>
)

export class GenericRouter<RequestType> {
  handlers: Array<{
    method: string,
    path: string,
    matcher: Matcher,
    callbacks: Array<GenericHandlerCallback<RequestType>>,
    isPrefix: boolean,
  }> = [];
  constructor(
    private getRequestURL: (request: RequestType)=>URL,
    private getRequestMethod: (request: RequestType)=>string,
    private config: RouterConfig  = {}
  ){}
  use(path: string, ...callbacks: Array<GenericRouterCallbackArg<RequestType>>){
    return this.addHandler("*", path, true, ...callbacks);
  }
  all(path: string, ...callbacks: Array<GenericRouterCallbackArg<RequestType>>){
    return this.addHandler("*", path, false, ...callbacks);
  }
  protected addHandler(
    method: string, path: string, isPrefix: boolean,
    ...callbacks: Array<GenericRouterCallbackArg<RequestType>>
  ){
    const matcher = match(path, { end: !isPrefix, decode: decodeURIComponent });
    const realCallbacks: Array<GenericHandlerCallback<RequestType>> = callbacks.map((callback)=>(
      (callback instanceof GenericRouter) ? (request, params, cb)=>(callback.handleRequest(request, cb, params)) :
      callback
    ));
    this.handlers.push({
      method: method,
      path: path,
      matcher: matcher,
      callbacks: realCallbacks,
      isPrefix: isPrefix,
    });
    return this;
  }
  handleRequest(request: RequestType, callback: (err?: any)=>void, parentRoute?: RouteInfo){
    if(!parentRoute){
      parentRoute = {
        url: new URL(this.getRequestURL(request).href, "ws://localhost:80"),
        params: {},
      }
    } else {
      parentRoute = {
        url: new URL(parentRoute.url.href),
        params: !this.config.mergeParams ? {} : { ...parentRoute.params },
      }
    }

    const pathname = parentRoute.url.pathname;
    if(pathname === null){
      Promise.resolve(new Error("no pathname in request")).then(callback);
      return;
    }
    const method = this.getRequestMethod(request);

    eachSeries(this.handlers, (handler, nextHandler)=>{
      if(handler.method !== method && handler.method !== "*") return nextHandler();
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

      eachSeries(handler.callbacks, async (fn, nextFn)=>{
        let callbacks = 0
        let failed = false;
        try {
          await fn(request, nextInfo, (err?: any)=>{
            callbacks++;
            if(callbacks > 1){
              console.error("Callback called multiple times", callbacks);
              console.trace();
              return;
            }
            if(failed){
              console.error("Callback called after error", callbacks);
              console.trace();
              return;
            }
            nextFn(err);
          });
        }catch(e){
          if(callbacks > 0){
            console.error("Error occured after callback called");
            console.trace();
            return;
          }
          failed = true;
          nextFn(e);
        }
      }, nextHandler);
    }, callback);
  }
}

