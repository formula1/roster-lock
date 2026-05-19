
export const RUN_UNTRUSTED_COMMAND = "run-untrusted-script";

export function createRunArgs(){
  return [RUN_UNTRUSTED_COMMAND];
}

export function shouldRunUntrustedScriptInFork(){
  return process.argv[1] === RUN_UNTRUSTED_COMMAND;
}

