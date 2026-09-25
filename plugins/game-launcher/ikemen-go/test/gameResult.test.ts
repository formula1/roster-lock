import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { StartGameArgs } from "@roster-lock/types";
import { resolveGameEndedResult } from "../src/startGame/gameResult";
import { IkemenGameConfig } from "../src/selectionValidation";

const DOCS_DIR = join(__dirname, "../docs");

// "zed" is deliberately NOT the alphabetically-first id, and deliberately
// unrelated to which machine is host/client - proves the WinSide mapping
// sorts playerIds itself rather than trusting insertion order or assuming
// "0 = host, 1 = client" (which doesn't generalize - see buildArgs.ts's
// sortedPlayerIds).
function argsFor(playerIds: [string, string]): StartGameArgs<IkemenGameConfig> {
  return {
    selectionResult: {
      finalSelection: {
        character: {
          type: "personal",
          value: Object.fromEntries(playerIds.map((id) => [id, [{ id: "kfm", required: {} }]])),
        },
      },
      downloadResults: {},
    },
  } as unknown as StartGameArgs<IkemenGameConfig>;
}

describe("resolveGameEndedResult", () => {
  it("maps WinSide 0 to the sorted-order first playerId", async () => {
    const args = argsFor(["zed", "amy"]);
    const result = await resolveGameEndedResult(join(DOCS_DIR, "abc123-host.host-win.txt"), args);
    expect(result?.winners).toEqual(["amy"]);
  });

  it("maps WinSide 1 to the sorted-order second playerId", async () => {
    const args = argsFor(["zed", "amy"]);
    const result = await resolveGameEndedResult(join(DOCS_DIR, "abc123-host.client-win.txt"), args);
    expect(result?.winners).toEqual(["zed"]);
  });

  it("reports no result when a player left early (WinSide -1)", async () => {
    const args = argsFor(["zed", "amy"]);
    const result = await resolveGameEndedResult(join(DOCS_DIR, "abc123-host.leave.txt"), args);
    expect(result).toBeUndefined();
  });

  // Host and client each run their own Ikemen instance and each write their
  // own copy of this log - this is the empirical basis for trusting either
  // side's own log for its own local stats (see docs/ - the two files for
  // any one outcome are byte-identical apart from the Lua table's pointer
  // address).
  it("gives the same result reading either side's own log for the same match", async () => {
    const args = argsFor(["zed", "amy"]);
    const fromHostLog = await resolveGameEndedResult(join(DOCS_DIR, "abc123-host.host-win.txt"), args);
    const fromClientLog = await resolveGameEndedResult(join(DOCS_DIR, "abc123-client.host-win.txt"), args);
    expect(fromClientLog).toEqual(fromHostLog);
  });
});
