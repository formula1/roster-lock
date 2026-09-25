

function main(){
  // count each selected item
  let maximum = 0;
  const map = {};
  const bySelection = {};
  for(const user of users){
    const chosen = selection[user][0];
    const newValue = (map[chosen.id] || 0) + 1;
    map[chosen.id] = newValue;
    bySelection[chosen.id] = chosen;
    if(newValue > maximum) maximum = newValue;
  }

  // log("map:", map);

  // get all maximum
  const equalKeys = [];
  for(const [k, v] of Object.entries(map)){
    if(v === maximum){
      equalKeys.push(k);
    }
  }

  // if only one maximum, return it
  // (return the winning user's full selection, not a synthesized one, so
  // its required substructure - e.g. weather under stage - is preserved)
  if(equalKeys.length === 1){
    return [bySelection[equalKeys[0]]];
  }
  // if multiple, choose one at random
  const index = randomInt(0, equalKeys.length - 1);
  return [bySelection[equalKeys[index]]];
}
