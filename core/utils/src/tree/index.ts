enum State {
  Unchecked,
  Checking,
  NoProblems,
}

export function treeHasCycle(keys: Array<string>, getRequires: (key: string) => Array<string>): null | Array<string> {
  const checkState = new Map<string, State>();
  let activeError: null | string = null;

  // Initialize all as unvisited
  for (const name of keys) {
    checkState.set(name, State.Unchecked);
  }

  // If we have a cycle, return true
  function checkDependencies(name: string, depChain: Array<string>): null | Array<string> {
    checkState.set(name, State.Checking);  // Currently visiting
    depChain.push(name);

    const requireList = getRequires(name);
    for (const required of requireList) {
      if(!checkState.has(required)){
        activeError = `Missing required ${required} for ${name}`;
        return null;
      }
      const requiredState = checkState.get(required);

      // If the required node has already been considered clean, we're ok
      if (requiredState === State.NoProblems) continue;
      // If the required node has been visited in this branch, we have a cycle
      if (requiredState === State.Checking){
        depChain.push(required);
        return depChain;
      }
      // Otherwise this is a new node we need to check
      const descendantChain = checkDependencies(required, depChain)
      if (descendantChain) return descendantChain;
    }

    // all dependencies are clean so this is clean
    checkState.set(name, State.NoProblems);
    depChain.pop();
    return null;
  }

  for (const name of keys) {
    // If we haven't visited this node yet, visit it
    if (checkState.get(name) === State.Unchecked) {
      const chain = checkDependencies(name, [])
      if (chain) return chain;
    }
    if(activeError) break;
  }

  if(activeError) throw new Error(activeError);

  return null;
}


enum FindAllState {
  Unchecked,
  Checking,
  Finished,
}
type Cycle = Array<string>;
export function findAllCycles(keys: Array<string>, getRequires: (key: string) => Array<string>): Array<Cycle> {
  const checkState = new Map<string, FindAllState>();
  const cycles: Array<Cycle> = [];
  let activeError: null | string = null;

  // Initialize all as unvisited
  for (const name of keys) {
    checkState.set(name, FindAllState.Unchecked);
  }

  // If we have a cycle, return true
  function checkDependencies(name: string, depChain: Array<string>) {
    checkState.set(name, FindAllState.Checking);  // Currently visiting
    depChain.push(name);

    const requireList = getRequires(name);
    for (const required of requireList) {
      if(!checkState.has(required)){
        activeError = `Missing required ${required} for ${name}`;
        return;
      }
      const requiredState = checkState.get(required);

      // If the required node has already been considered clean, we're ok
      if (requiredState === FindAllState.Finished) continue;
      // If the required node has been visited in this branch, we have a cycle
      if (requiredState === FindAllState.Checking){
        const newCycle = [...depChain, required];
        // The start of the dependency chain may not be the start of the cycle
        // For each cycle, rotate the elements until the start of the cycle is the first element
        while(newCycle[0] !== newCycle.at(-1)) newCycle.shift();
        cycles.push(newCycle)
        continue;
      }
      // Otherwise this is a new node we need to check
      checkDependencies(required, depChain)
      if(activeError) return;
    }

    // all dependencies are clean so this is clean
    checkState.set(name, FindAllState.Finished);
    depChain.pop();
    return;
  }

  for (const name of keys) {
    // If we haven't visited this node yet, visit it
    if (checkState.get(name) === FindAllState.Unchecked) {
      checkDependencies(name, [])
    }
    if(activeError) break;
  }

  if(activeError) throw new Error(activeError);

  return cycles;
}


export function getCyclesUsingKey(key: string, allCycles: Array<Cycle>){
  const pieceCycles = [];
  for(const cycleMutable of allCycles){
    if(!cycleMutable.includes(key)) continue
    const cycle = [...cycleMutable];
    if(cycle[0] === key){
      pieceCycles.push(cycle);
      continue;
    }
    cycle.shift();
    while(cycle[0] !== key){
      const first = cycle.shift();
      if(!first) throw new Error("Empty cycle, shouldn't happen");
      cycle.push(first);
    }
    cycle.push(key);
    pieceCycles.push(cycle);
  }
  return pieceCycles;
}
