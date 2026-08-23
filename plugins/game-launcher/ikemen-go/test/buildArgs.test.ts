import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { ConnectionConfig, StartGameArgs, RosterLockV1Config } from "@roster-lock/types";
import { buildIkemenArgs, IkemenGameConfig } from "../src/startGame/buildArgs";

// The real MUGEN example config, not a hand-written stub - it's what proves the
// defName convention survives a config the editor actually produced. Rebuild it
// with examples/mugen/build-draft.sh.
const EXAMPLE_DIR = join(__dirname, "../../../../examples/mugen/roster-locks");
const DRAFT_PATH = join(EXAMPLE_DIR, "mugen.rosterlock.draft.json");
const rosterConfig: RosterLockV1Config = JSON.parse(readFileSync(DRAFT_PATH, "utf-8")).stagedLock;

// One published lock per team mode - same engine and rosters, different
// selection config.
function loadLock(mode: string): RosterLockV1Config {
  return JSON.parse(readFileSync(join(EXAMPLE_DIR, `mugen-${mode}.roster-lock.json`), "utf-8"));
}

const KFM = "@elecbyte/kung-fu-man";
// Deliberately used throughout: its def is kfm_zss.def while every asset that
// def references is kfm.* - so anything inferring the def name from the folder
// or from a sibling asset gets this one wrong.
const KFM_ZSS = "@elecbyte/kung-fu-man-zss";
const BAIKEN = "@tornillooxidado/baiken";
const KYO = "@ikaruga/kyo-kusanagi";
const TRAINING_ROOM = "@elecbyte/training-room";

const HOST: ConnectionConfig = { type: "direct-tcp", party: "host", port: 7500 };

// match-agent names piece folders with a ULID, never with the piece's own name.
function folderFor(pieceId: string){
  return `/var/roster-lock/pieces/ikemen-go/${pieceId.replace(/[^a-z0-9]/gi, "")}-01j9k2xq7f8m3v0anb5cywd6re`;
}

function downloadFor(pieceType: string, pieceId: string){
  return {
    pieceType, pieceId,
    pieceVersions: { logic: "logic-hash", media: "media-hash" },
    folder: folderFor(pieceId),
  };
}

function buildArgs(
  sides: Record<string, Array<string>>,
  options: {
    stage?: string,
    gameConfig?: unknown,
    connection?: ConnectionConfig,
    config?: RosterLockV1Config,
  } = {},
){
  const characterIds = Object.values(sides).flat();
  const args = {
    relayRoomId: "room-1",
    currentMachine: { machineId: "m1", publicKey: "pk", privateKeyFile: "/tmp/key" },
    allMachines: [],
    rosterConfig: options.config ?? rosterConfig,
    matchAgent: { port: 9000, authCode: "auth" },
    gameConfig: options.gameConfig,
    selectionResult: {
      finalSelection: {
        character: {
          type: "personal",
          value: Object.fromEntries(
            Object.entries(sides).map(([playerId, ids]) => [playerId, ids.map((id) => ({ id, required: {} }))])
          ),
        },
        ...(options.stage ? { stage: { type: "shared", value: [{ id: options.stage, required: {} }] } } : {}),
      },
      downloadResults: {
        character: Object.fromEntries(characterIds.map((id) => [id, downloadFor("character", id)])),
        stage: options.stage ? { [options.stage]: downloadFor("stage", options.stage) } : {},
      },
    },
  } as unknown as StartGameArgs<IkemenGameConfig>;
  return buildIkemenArgs(options.connection ?? HOST, args);
}

// Reads the value Ikemen would see for a flag, e.g. valueOf(args, "-p1").
function valueOf(args: Array<string>, flag: string){
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

describe("buildIkemenArgs - character def paths", () => {
  it("points -p<n> at the .def file inside the piece folder, not the folder", () => {
    const args = buildArgs({ alice: [KFM], bob: [BAIKEN] });
    expect(valueOf(args, "-p1")).toBe(join(folderFor(KFM), "kfm.def"));
    expect(valueOf(args, "-p2")).toBe(join(folderFor(BAIKEN), "Baiken.def"));
  });

  it("uses the defName path variable rather than anything derivable from the folder", () => {
    const args = buildArgs({ alice: [KFM_ZSS], bob: [KYO] });
    // The folder is a ULID and the piece's other assets are all kfm.* - only
    // pathVariables.defName knows this file is kfm_zss.def.
    expect(valueOf(args, "-p1")).toBe(join(folderFor(KFM_ZSS), "kfm_zss.def"));
    expect(valueOf(args, "-p1")).not.toContain("kfm.def");
    expect(valueOf(args, "-p2")).toBe(join(folderFor(KYO), "Kyo.def"));
  });

  it("never passes a bare folder to Ikemen", () => {
    const args = buildArgs({ alice: [KFM], bob: [KYO] }, { stage: TRAINING_ROOM });
    for(const flag of ["-p1", "-p2", "-s"]){
      expect(valueOf(args, flag)).toMatch(/\.def$/);
    }
  });

  it("resolves the stage's def the same way", () => {
    const args = buildArgs({ alice: [KFM], bob: [KYO] }, { stage: TRAINING_ROOM });
    expect(valueOf(args, "-s")).toBe(join(folderFor(TRAINING_ROOM), "stage0.def"));
  });

  it("omits -s entirely when nothing picked a stage", () => {
    expect(buildArgs({ alice: [KFM], bob: [KYO] })).not.toContain("-s");
  });
});

describe("buildIkemenArgs - team modes", () => {
  it("emits the numeric TeamMode, since Ikemen reads -tmode with tonumber()", () => {
    const cases = { single: "0", simul: "1", turns: "2", tag: "3" } as const;
    for(const [name, expected] of Object.entries(cases)){
      const args = buildArgs({ alice: [KFM], bob: [KYO] }, { gameConfig: { teamMode: name } });
      expect(valueOf(args, "-tmode1")).toBe(expected);
      expect(valueOf(args, "-tmode2")).toBe(expected);
    }
  });

  // Each published lock carries one of the four selection configs, all four of
  // which are registered in engine.officialSelections. The mode follows from
  // whichever one the room agreed on.
  it.each([
    ["single", "0", 1],
    ["simul", "1", 2],
    ["tag", "3", 3],
    ["turns", "2", 4],
  ])("derives %s from the room's selection config", (mode, expected, count) => {
    const lock = loadLock(mode);
    const picks = [KFM, BAIKEN, KYO, KFM_ZSS].slice(0, count);
    const args = buildArgs({ alice: picks, bob: picks }, { config: lock });
    expect(valueOf(args, "-tmode1")).toBe(expected);
    expect(valueOf(args, "-tmode2")).toBe(expected);
    // ...and that config really does ask for this many characters.
    expect(lock.selection.piece.character.validation.count).toBe(count);
  });

  it("lets gameConfig override the selection config's mode", () => {
    const args = buildArgs({ alice: [KFM, BAIKEN, KYO], bob: [KFM, BAIKEN, KYO] }, {
      config: loadLock("tag"),
      gameConfig: { teamMode: "turns" },
    });
    expect(valueOf(args, "-tmode1")).toBe("2");
  });

  it("falls back to the character count when no official selection matches", () => {
    // A custom selection config is still valid, it just isn't one of the
    // engine's registered ones - so there's no tag to read a mode off.
    const config = JSON.parse(JSON.stringify(rosterConfig)) as RosterLockV1Config;
    // 1-2 picks isn't any of the four registered counts, so it hashes to
    // something officialSelections has never heard of.
    config.selection.piece.character.validation.count = [1, 2];
    expect(valueOf(buildArgs({ alice: [KFM], bob: [KYO] }, { config }), "-tmode1")).toBe("0");
    expect(valueOf(buildArgs({ alice: [KFM, BAIKEN], bob: [KYO, KFM_ZSS] }, { config }), "-tmode1")).toBe("1");
  });
});

describe("buildIkemenArgs - slot numbering", () => {
  it("interleaves slots by side, because Ikemen derives the side from parity", () => {
    const args = buildArgs({ alice: [KFM, BAIKEN], bob: [KYO, KFM_ZSS] });
    // Odd slots are side 1 (alice), even are side 2 (bob) - main.f_playerSide.
    expect(valueOf(args, "-p1")).toContain("kfm.def");
    expect(valueOf(args, "-p3")).toContain("Baiken.def");
    expect(valueOf(args, "-p2")).toContain("Kyo.def");
    expect(valueOf(args, "-p4")).toContain("kfm_zss.def");
  });

  it("keeps a full 4v4 inside -p1..-p8", () => {
    const four = [KFM, BAIKEN, KYO, KFM_ZSS];
    const args = buildArgs({ alice: four, bob: four });
    expect(args.filter((a) => /^-p\d+$/.test(a)).sort())
      .toEqual(["-p1", "-p2", "-p3", "-p4", "-p5", "-p6", "-p7", "-p8"]);
  });

  it("rejects more characters than Ikemen's MaxSimul", () => {
    const five = [KFM, BAIKEN, KYO, KFM_ZSS, "@elecbyte/kung-fu-man-720"];
    expect(() => buildArgs({ alice: five, bob: [KYO] })).toThrow(/at most 4 characters per side/);
  });
});

describe("buildIkemenArgs - connection", () => {
  it("passes -ip with an empty value for the host, so Ikemen actually listens", () => {
    // Ikemen's own -h output: "-ip <hostip> Connect to <hostip> for netplay;
    // leave blank for host" - omitting the flag entirely (not the same
    // thing) means Ikemen never engages netplay at all.
    const args = buildArgs({ alice: [KFM], bob: [KYO] });
    expect(valueOf(args, "-ip")).toBe("");
    expect(valueOf(args, "-setport")).toBe("7500");
  });

  it("passes -ip for a client, using the resolved host address", () => {
    const args = buildArgs({ alice: [KFM], bob: [KYO] }, {
      connection: { type: "direct-tcp", party: "client", port: 7500, hostIp: "10.0.0.5" },
    });
    expect(valueOf(args, "-ip")).toBe("10.0.0.5");
    expect(valueOf(args, "-setport")).toBe("7500");
  });

  it("refuses connection types it can't actually drive", () => {
    expect(() => buildArgs({ alice: [KFM], bob: [KYO] }, {
      connection: { type: "internal" },
    })).toThrow(/doesn't support connection type "internal"/);
  });
});

describe("buildIkemenArgs - failures", () => {
  it("names the piece missing a defName rather than building a bad path", () => {
    const config = JSON.parse(JSON.stringify(rosterConfig)) as RosterLockV1Config;
    const piece = config.rosters.character.find((p) => p.id === KFM)!;
    delete piece.pathVariables.defName;
    expect(() => buildArgs({ alice: [KFM], bob: [KYO] }, { config }))
      .toThrow(/character\/@elecbyte\/kung-fu-man to set a "defName" path variable/);
  });

  it("rejects a defName that would escape the piece folder", () => {
    const config = JSON.parse(JSON.stringify(rosterConfig)) as RosterLockV1Config;
    config.rosters.character.find((p) => p.id === KFM)!.pathVariables.defName = "../../etc/passwd";
    expect(() => buildArgs({ alice: [KFM], bob: [KYO] }, { config }))
      .toThrow(/expects "defName" to be a bare file name/);
  });

  it("reports a piece that isn't in the roster", () => {
    expect(() => buildArgs({ alice: ["@elecbyte/not-downloaded"], bob: [KYO] }))
      .toThrow(/No roster entry for character\/@elecbyte\/not-downloaded/);
  });

  it("rejects a side with no characters", () => {
    expect(() => buildArgs({ alice: [], bob: [KYO] })).toThrow(/no characters selected/);
  });

  it("rejects anything other than two sides", () => {
    expect(() => buildArgs({ alice: [KFM] })).toThrow(/only supports 2-side matches/);
    expect(() => buildArgs({ alice: [KFM], bob: [KYO], carol: [BAIKEN] }))
      .toThrow(/only supports 2-side matches/);
  });
});

describe("the mugen example config", () => {
  it("gives every character and stage a defName naming a real .def", () => {
    for(const pieceType of ["character", "stage"]){
      const pieces = rosterConfig.rosters[pieceType];
      expect(pieces.length).toBeGreaterThan(0);
      for(const piece of pieces){
        expect(piece.pathVariables.defName, `${pieceType}/${piece.id}`).toBeTruthy();
      }
    }
  });

  it("declares defName on both piece types so the globs can use it", () => {
    for(const pieceType of ["character", "stage"]){
      expect(rosterConfig.engine.pieceDefinitions[pieceType].pathVariables).toContain("defName");
    }
  });

  it("pins the definition asset to exactly one file", () => {
    for(const pieceType of ["character", "stage"]){
      const definition = rosterConfig.engine.pieceDefinitions[pieceType].assets
        .find((a) => a.name === "definition")!;
      expect(definition.count).toBe(1);
      expect(definition.glob).toEqual(["<defName>.def"]);
    }
  });
});
