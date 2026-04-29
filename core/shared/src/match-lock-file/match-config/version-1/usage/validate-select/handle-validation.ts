
import { RunUntrustedError } from "./constants";

export async function handleValidationResult(
  script: { src: string }, result: Promise<unknown>
){
  const isValid = await (async ()=>{
    try {
      return await result
    }catch(e){
      throw new RunUntrustedError(
        script.src, e instanceof Error ? e.message : String(e), e
      )
    }
  })()
  const errorStatus = normalizeError(isValid);
  if(!errorStatus.passed){
    throw new RunUntrustedError(
      script.src, errorStatus.message, isValid
    );
  }
}

const INVALID_VALUE = "Invalid return type for validation";
const FAILED_WITHOUT_MESSAGE = "Validation Failed";
function normalizeError(validResult: unknown): (
  | { passed: true }
  | { passed: false, message: string }
){
  if(typeof validResult === "boolean"){
    if(validResult) return { passed: true };
    return { passed: false, message: FAILED_WITHOUT_MESSAGE }
  }
  if(Array.isArray(validResult)){
    const [passed, reason] = validResult;
    if(typeof passed !== "boolean"){
      return { passed: false, message: INVALID_VALUE }
    }
    if(passed) return { passed: true }
    return {
      passed: false,
      message: typeof reason === "string" ? reason : FAILED_WITHOUT_MESSAGE,
    }
  }
  if(typeof validResult === "string"){
    return {
      passed: false,
      message: validResult
    }
  }
  if(validResult === null || validResult === void 0) return { passed: true };
  return { passed: false, message: INVALID_VALUE };
}

