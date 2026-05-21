
import { UntrustedScript } from "@roster-lock/types";
import { LuaFactory } from "wasmoon";
import { getOrCreate } from "./util";

const getFactory = getOrCreate(() => new LuaFactory());

const MAX_GAS = 5_000_000;

// Inlined as a string so it runs inside the single gas-limited doString context.
const RNG_OVERRIDE_LUA = `
  do
    local _m = {}
    for k, v in pairs(math) do
      if k ~= "random" and k ~= "randomseed" then _m[k] = v end
    end
    math = _m
  end
  function math.random(m, n)
    if m == nil and n == nil then return randomFloat() end
    if n == nil then return randomInt(1, m) end
    return randomInt(m, n)
  end
  function math.randomseed() error("math.randomseed is disabled") end
`;

export const runLuaScript: UntrustedScript<any>["runScript"] = async function(
  globals, input, script, initialMethod
) {
  const factory = getFactory();
  const lua = await factory.createEngine();

  try {
    // Block filesystem access
    lua.global.set("dofile", undefined);
    lua.global.set("loadfile", undefined);
    lua.global.set("loadstring", undefined);
    lua.global.set("io", undefined);
    lua.global.set("os", undefined);

    // RNG globals (referenced by RNG_OVERRIDE_LUA)
    lua.global.set("randomFloat", () => globals.randomFloat());
    lua.global.set("randomInt", (min: number, max: number) => globals.randomInt(min, max));
    lua.global.set("shuffleIndexes", (length: number) => globals.shuffleIndexes(length, 1));

    // Piece globals
    lua.global.set("getPieceMeta", (pieceType: string, pieceId: string) =>
      globals.getPieceMeta(pieceType, pieceId)
    );
    lua.global.set("getAvailablePieces", (pieceType: string) =>
      globals.getAvailablePieces(pieceType)
    );

    // Module loader — sync or async depending on the host
    lua.global.set("require", (relativePath: string) =>
      globals.requireScript(relativePath, (fullPath, newContent) =>
        lua.doString(`return (function() ${newContent} end)()`)
      )
    );

    // Input globals
    lua.global.set("scriptPurpose", input.type);
    if (input.type === "piece-user-validation") {
      lua.global.set("pieceType", input.pieceType);
      lua.global.set("selection", input.input);
    } else if (input.type === "piece-merge") {
      lua.global.set("pieceType", input.pieceType);
      lua.global.set("users", input.users);
      lua.global.set("selection", input.input);
    } else if (input.type === "global-validation") {
      lua.global.set("pieceTypes", input.pieceTypes);
      lua.global.set("users", input.users);
      lua.global.set("selection", input.input);
    } else {
      throw new Error("Unknown Input Type");
    }

    // The gas-limit hook, RNG override, user script, and main() call all run in
    // one doString so the debug hook stays active for the entire execution.
    return await lua.doString(`
      do
        local _gas = 0
        debug.sethook(function()
          _gas = _gas + 1
          if _gas > ${MAX_GAS} then error("Gas limit exceeded") end
        end, "", 1)
      end
      debug = nil

      ${RNG_OVERRIDE_LUA}

      ${script}

      if type(${initialMethod}) ~= "function" then
        error("No ${initialMethod} function defined in script")
      end
      local _ok, _val = pcall(${initialMethod})
      if not _ok then error(_val, 0) end
      return _val
    `);
  } finally {
    lua.global.close();
  }
};
