
export * from "./SimpleEvent";
export * from "./withResolvers";

export function delay(ms: number){
  return new Promise(resolve=>setTimeout(resolve, ms));
}
