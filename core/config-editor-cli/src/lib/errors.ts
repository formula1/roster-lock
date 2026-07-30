import { ErrorObject } from "ajv";
import { ZodError } from "zod";

export function formatError(e: unknown): string {
  if(e instanceof ZodError){
    return e.issues
      .map((issue) => `/${issue.path.join("/")} ${issue.message}`)
      .join("\n");
  }
  if(Array.isArray(e)){
    return (e as Array<ErrorObject>)
      .map((err) => `${err.instancePath || "/"} ${err.message}`)
      .join("\n");
  }
  if(e instanceof Error) return e.message;
  return String(e);
}

export function withErrorHandling<Args extends Array<any>>(
  fn: (...args: Args) => Promise<void>
) {
  return async (...args: Args) => {
    try {
      await fn(...args);
    } catch(e){
      console.error(formatError(e));
      process.exitCode = 1;
    }
  };
}
