import { createJsonnetRuntime, JsonnetRuntimeEvaluator } from "@primafuture/jsonnet-runtime";
import { UntrustedConfig } from "@roster-lock/types";

let runtime: JsonnetRuntimeEvaluator | undefined;
function getRuntime(){
  if(!runtime) runtime = createJsonnetRuntime();
  return runtime;
}

const jsonnet: UntrustedConfig = {
  name: "jsonnet",
  extensions: [".jsonnet"],
  async runConfig(configString: string){
    return getRuntime().evaluateSnippet({ snippet: configString });
  }
};

export default jsonnet;
