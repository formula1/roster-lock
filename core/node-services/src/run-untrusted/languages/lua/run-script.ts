import { ScriptRunner } from "../types";
import { LuaFactory, LuaEngine } from 'wasmoon';

const factory = new LuaFactory()

export const runLuaScript: ScriptRunner<any> = async function(globals, input, script){
  const lua = await factory.createEngine()

  try {

    addGasLimit(lua, 5_000_000);

    // Prevent filesystem calls
    lua.global.set('dofile', undefined);
    lua.global.set('loadfile', undefined);
    lua.global.set('io', undefined);
    lua.global.set('os', undefined); // Also block os module
    lua.global.set('debug', undefined); // Block debug hooks

    // Add RNG Globals
    lua.global.set('randomFloat', () =>(globals.randomFloat()));
    lua.global.set('randomInt', (min: number, max: number) =>(globals.randomInt(min, max)));
    lua.global.set('shuffleIndexes', (length: number) =>(
      globals.shuffleIndexes(length, 1)
    ));
    await overrideDefaultRNG(lua);

    // Add Piece Related Globals
    lua.global.set('getPieceMeta', (pieceType: string, pieceId: string) =>(
      globals.getPieceMeta(pieceType, pieceId)
    ));
    lua.global.set('getAvailablePieces', (pieceType: string) =>(
      globals.getAvailablePieces(pieceType)
    ));


    // Add requireScript
    lua.global.set('require', (relativePath: string) =>(
      globals.requireScript(relativePath, (fullPath, newContent)=>(
        lua.doString(`
          return (function()
            ${newContent}
          end)()
        `)
      ))
    ));

    // Add Input
    if(input.type === "piece-user-validation"){
      lua.global.set('selection', input.input);
    } else if(input.type === "piece-merge"){
      lua.global.set('users', input.users);
      lua.global.set('selection', input.input);
    } else if(input.type === "global-validation"){
      lua.global.set('users', input.users);
      lua.global.set('pieceTypes', input.pieceTypes);
      lua.global.set('selection', input.input);
    } else {
      throw new Error("Unknown Input Type");
    }

    await lua.doString(script);

    const main = lua.global.get("main")
    if(typeof main !== "function"){
      throw new Error("No main function defined in script");
    }
    return await main(input.input);
  }finally{
    lua.global.close();
  }
}

async function addGasLimit(lua: LuaEngine, maxGas: number){
  await lua.doString(`
    do
      local gasUsed = 0
      local gasLimit = ${maxGas}
      
      debug.sethook(function()
        gasUsed = gasUsed + 1
        if gasUsed > gasLimit then
          error("Gas limit exceeded")
        end
      end, "", 1)
    end
  `);
}

async function overrideDefaultRNG(lua: LuaEngine){
  await lua.doString(`
    -- Save original math table
    local originalMath = {}
    for k, v in pairs(math) do
      if k ~= "random" and k ~= "randomseed" then
        originalMath[k] = v
      end
    end
    
    -- Replace math table with safe functions only
    math = originalMath

    -- Override math.random to use seeded RNG
    function math.random(m, n)
      if m == nil and n == nil then
        -- math.random() -> [0, 1)
        return randomFloat()
      elseif n == nil then
        -- math.random(m) -> [1, m]
        return randomInt(1, m)
      else
        -- math.random(m, n) -> [m, n]
        return randomInt(m, n)
      end
    end
    
    -- Disable randomseed (seeds are controlled by your system)
    function math.randomseed(seed)
      error("math.randomseed is disabled - RNG is controlled by RosterLock")
    end
  `);

}