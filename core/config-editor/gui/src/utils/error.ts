
export function errorToString(err: unknown){
  if(!err) return "Unknown Error";
  if(typeof err === "string") return err;
  if(typeof err !== "object" || Array.isArray(err)) return "Unknown Error";
  if(err instanceof Error) return err.message;
  if("message" in err && typeof err.message === "string") return err.message;
  return err.toString()
}
