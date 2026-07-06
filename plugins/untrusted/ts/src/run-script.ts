
import { UntrustedScript } from "@roster-lock/types";
import { newQuickJSAsyncWASMModule, QuickJSContext } from "quickjs-emscripten";
import { extractQuickJSError } from "./error";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

import { getOrCreate } from "./util";

const getQuickJSPromise = getOrCreate(()=>(newQuickJSAsyncWASMModule()));

const MAX_CYCLES = 5_000_000 / 1024;
export const runTSScript: UntrustedScript<string>["runScript"] = async function(
  globals, input, scriptRaw, initialMethod
){
  const QuickJS = await getQuickJSPromise();
  const vm = QuickJS.newContext();

  try {

    let interruptCycles = 0;
    vm.runtime.setInterruptHandler(() => ++interruptCycles > MAX_CYCLES);
    vm.runtime.setModuleLoader((relativePath)=>(
      globals.requireScript(relativePath, async (fullPath, scriptContent)=>{
        const { outputText } = transpileModule(scriptContent, {
          compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext }
        });
        return outputText;
      })
    ));

    // Debug
    vm.setProp(vm.global, "log", vm.newFunction("log", (...handles) => {
      globals.log(...handles.map(h => vm.dump(h)));
    }));

    // RNG
    vm.setProp(vm.global, "randomFloat", vm.newFunction("randomFloat", ()=>{
      return vm.newNumber(globals.randomFloat());
    }));
    vm.setProp(vm.global, "randomInt", vm.newFunction("randomInt", (minHandle, maxHandle)=>{
      const min = vm.getNumber(minHandle);
      const max = vm.getNumber(maxHandle);
      return vm.newNumber(globals.randomInt(min, max));
    }));
    vm.setProp(vm.global, "shuffleIndexes", vm.newFunction("shuffleIndexes", (lengthHandle)=>{
      const length = vm.getNumber(lengthHandle);
      const indexes = globals.shuffleIndexes(length);
      return newJSON(vm, indexes);
    }));
    // Overriding the Math.random just in case people try to use it
    vm.evalCode("Math.random = randomFloat;");

    vm.setProp(vm.global, "getPieceMeta", vm.newFunction("getPieceMeta", (pieceTypeHandle, pieceIdHandle) =>{
      const pieceType = vm.getString(pieceTypeHandle);
      const pieceId = vm.getString(pieceIdHandle);
      const meta = globals.getPieceMeta(pieceType, pieceId);
      return newJSON(vm, meta);
    }));
    vm.setProp(vm.global, "getAvailablePieces", vm.newFunction("getAvailablePieces", (pieceTypeHandle) =>{
      const pieceType = vm.getString(pieceTypeHandle);
      const pieces = globals.getAvailablePieces(pieceType);
      return newJSON(vm, pieces);
    }));

    // Add Input
    vm.setProp(vm.global, "scriptPurpose", vm.newString(input.type));
    if(input.type === "piece-user-validation"){
      vm.setProp(vm.global, "pieceType", vm.newString(input.pieceType));
      vm.setProp(vm.global, "selection", newJSON(vm, input.input));
    } else if(input.type === "piece-merge"){
      vm.setProp(vm.global, "pieceType", vm.newString(input.pieceType));
      vm.setProp(vm.global, "users", newJSON(vm, input.users));
      vm.setProp(vm.global, "selection", newJSON(vm, input.input));
    } else if(input.type === "global-validation"){
      vm.setProp(vm.global, "pieceTypes", newJSON(vm, input.pieceTypes));
      vm.setProp(vm.global, "users", newJSON(vm, input.users));
      vm.setProp(vm.global, "selection", newJSON(vm, input.input));
    } else {
      throw new Error("Unknown Input Type");
    }

    const { outputText } = transpileModule(scriptRaw, {
      compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext }
    });
    const throwIfInterrupted = () => {
      if (interruptCycles > MAX_CYCLES) throw new Error("Script cycle limit exceeded");
    };

    const loadResult = await vm.evalCodeAsync(outputText);
    if ("error" in loadResult) {
      throwIfInterrupted();
      throw extractQuickJSError(vm, loadResult.error!);
    }
    loadResult.value!.dispose();

    const main = vm.getProp(vm.global, initialMethod);
    if(vm.typeof(main) !== "function"){
      throw new Error(`No ${initialMethod} function defined in script`);
    }

    const evalResult = await vm.evalCodeAsync(`Promise.resolve().then(()=>(${initialMethod}()));`);
    if ("error" in evalResult) {
      throwIfInterrupted();
      throw extractQuickJSError(vm, evalResult.error!);
    }
    const resultPromise = vm.resolvePromise(evalResult.value!);
    vm.runtime.executePendingJobs();
    const awaitedResult = await resultPromise;
    if ("error" in awaitedResult) {
      throwIfInterrupted();
      throw extractQuickJSError(vm, awaitedResult.error!);
    }
    return vm.dump(awaitedResult.value!);
  }finally{
    vm.dispose();
  }
};

function newJSON(vm: QuickJSContext, value: any){
  return vm.unwrapResult(vm.evalCode(JSON.stringify(value)));
}

