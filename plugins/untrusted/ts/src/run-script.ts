
import { UntrustedScript } from "@roster-lock/types";
import { newQuickJSAsyncWASMModule, QuickJSContext } from "quickjs-emscripten";
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
    await vm.evalCodeAsync(outputText);

    const main = vm.getProp(vm.global, initialMethod);
    if(vm.typeof(main) !== "function"){
      throw new Error(`No ${initialMethod} function defined in script`);
    }
    // Convert everything to a promise for sanities sake
    const awaitedResult = await vm.resolvePromise(
      vm.unwrapResult(
        await vm.evalCodeAsync(`Promise.resolve().then(()=>(${initialMethod}()));`)
      )
    );
    // The unwrap should throw if the script throws
    return vm.dump(vm.unwrapResult(awaitedResult));
  }finally{
    vm.dispose();
  }
};

function newJSON(vm: QuickJSContext, value: any){
  return vm.unwrapResult(vm.evalCode(JSON.stringify(value)));
}

