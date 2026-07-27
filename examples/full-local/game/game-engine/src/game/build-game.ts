import { RosterLockV1SyncDLResult, SelectedPiece } from "@roster-lock/types";

import { GameState } from "../types";
import { Character, GaugeType } from "../types/character";
import { RunnableMove } from "../types/move";
import { WeatherType } from "../types/stage";
import { PieceFilesConfig, loadPieceModule, loadPieceStats } from "./assets/loadPieceFile";

type LoadedCache = {
  character: Record<string, Promise<{ stats: { hp: number, attack: number, speed: number } }>>
  move: Record<string, Promise<RunnableMove>>,
  weather: Record<string, Promise<{}>>
}

// Character pieces only publish an hp/attack/speed multiplier (see stats.json5), not a raw
// gauge size — this scale is a placeholder until real character balance is decided.
const HP_SCALE = 10;
// Character pieces don't currently publish a stamina stat.
const STARTING_STAMINA = 10;

type MovePieceData = {
  damage: number,
  weather?: { type: string, turns: number } | null,
};

function movePieceToRunnable(moveData: MovePieceData): RunnableMove {
  const effects: RunnableMove = {
    damage: {
      type: "gauge-subtract",
      stat: GaugeType.Hp,
      value: moveData.damage,
      target: { type: "explicit", targets: 1 },
    },
  };
  if(moveData.weather){
    effects.weather = {
      type: "weather",
      value: { type: "fixed", value: moveData.weather.type as WeatherType },
      turns: moveData.weather.turns,
    };
  }
  return effects;
}

export async function buildGameFromSelection(
  selectionDownloadResult: RosterLockV1SyncDLResult,
  pieceFiles: PieceFilesConfig,
): Promise<{ gameState: GameState }> {
  const { finalSelection, downloadResults } = selectionDownloadResult;

  const characterSelection = finalSelection.character;
  if(!characterSelection || characterSelection.type !== "personal"){
    throw new Error(`Expected a "personal" selection for piece type "character"`);
  }
  const stageSelection = finalSelection.stage;
  if(!stageSelection || stageSelection.type !== "shared"){
    throw new Error(`Expected a "shared" selection for piece type "stage"`);
  }
  const stagePiece = stageSelection.value[0];
  if(!stagePiece){
    throw new Error(`No stage was selected`);
  }

  const loadedCache: LoadedCache = {
    character: {},
    move: {},
    weather: {},
  };


  const players: GameState["players"] = {};
  const characterLoads: Array<Promise<[string, Character]>> = [];
  for(const [machineIdPlayerNum, selectedCharacters] of Object.entries(characterSelection.value)){
    const userId = machineIdPlayerNum.split(":")[0]
    players[userId] = { id: userId };
    selectedCharacters.forEach((characterPiece, index) => {
      characterLoads.push(
        loadCharacter(userId, characterPiece, index, downloadResults, loadedCache, pieceFiles)
      );
    });
  }

  const [characterEntries, weather] = await Promise.all([
    Promise.all(characterLoads),
    loadStage(stagePiece, downloadResults, loadedCache, pieceFiles),
  ]);

  await Promise.all([
    Promise.all(Object.values(loadedCache.character)),
    Promise.all(Object.values(loadedCache.move)),
    Promise.all(Object.values(loadedCache.weather)),
  ])

  return {
    gameState: {
      turnCount: 0,
      winners: null,
      stage: { weather },
      players,
      characters: Object.fromEntries(characterEntries),
    },
  };
}

async function loadStage(
  stagePiece: SelectedPiece,
  downloadResults: RosterLockV1SyncDLResult["downloadResults"],
  loadedCache: LoadedCache,
  pieceFiles: PieceFilesConfig,
){
  const stageDownload = downloadResults.stage[stagePiece.id];
  if(!stageDownload) throw new Error(`Missing download for stage "${stagePiece.id}"`);
  const { onLoad } = await loadPieceModule(pieceFiles, "stage", stagePiece.id, "logic.js");

  const weatherSelections = [
    ...stagePiece.required.weather.mandatory,
    ...stagePiece.required.weather.selectable,
  ]

  for(const weather of weatherSelections){
    loadWeather(weather, downloadResults, loadedCache)
  }
  const { weather } = (onLoad as () => { weather: { type: WeatherType, turnsLeft: number } })();
  return weather;
};

async function loadCharacter(
  userId: string,
  characterPiece: SelectedPiece,
  index: number,
  downloadResults: RosterLockV1SyncDLResult["downloadResults"],
  loadedCache: LoadedCache,
  pieceFiles: PieceFilesConfig,
): Promise<[string, Character]>{
  const download = downloadResults.character[characterPiece.id];
  if(!download) throw new Error(`Missing download for character "${characterPiece.id}"`);

  const moveSelections = [
    ...characterPiece.required.move.mandatory,
    ...characterPiece.required.move.selectable,
  ];

  const [{ stats }, moves] = await Promise.all([
    loadStats(characterPiece, downloadResults, loadedCache, pieceFiles),
    Promise.all(moveSelections.map(async (movePiece)=>(
      [movePiece.id, await loadMove(movePiece, downloadResults, loadedCache, pieceFiles)] as const
    ))),
  ]);

  const characterId = `${userId}-${characterPiece.id}-${index}`;
  return [characterId, {
    id: characterId,
    ownerPlayer: userId,
    controllerPlayer: userId,
    [GaugeType.Hp]: { current: stats.hp * HP_SCALE, max: stats.hp * HP_SCALE },
    [GaugeType.Stamina]: { current: STARTING_STAMINA, max: STARTING_STAMINA },
    speed: stats.speed,
    attack: stats.attack,
    moves: Object.fromEntries(moves),
  }];
}

async function loadStats(
  characterPiece: SelectedPiece,
  downloadResults: RosterLockV1SyncDLResult["downloadResults"],
  loadedCache: LoadedCache,
  pieceFiles: PieceFilesConfig,
): LoadedCache["character"][string]{
  return loadedCache.character[characterPiece.id] ??= (async ()=>{
    const download = downloadResults.character[characterPiece.id];
    if(!download) throw new Error(`Missing download for character "${characterPiece.id}"`);
    return loadPieceStats<{ stats: { hp: number, attack: number, speed: number } }>(
      pieceFiles, "character", characterPiece.id, "stats.json5"
    );
  })()
}

async function loadMove(
  movePiece: SelectedPiece,
  downloadResults: RosterLockV1SyncDLResult["downloadResults"],
  loadedCache: LoadedCache,
  pieceFiles: PieceFilesConfig,
): LoadedCache["move"][string]{
  return loadedCache.move[movePiece.id] ??= (async () => {
    const moveDownload = downloadResults.move[movePiece.id];
    if(!moveDownload) throw new Error(`Missing download for move "${movePiece.id}"`);
    const { moveData } = await loadPieceModule(pieceFiles, "move", movePiece.id, "logic.js");

    const weatherSelections = [
      ...movePiece.required.weather.mandatory,
      ...movePiece.required.weather.selectable,
    ]

    for(const weather of weatherSelections){
      loadWeather(weather, downloadResults, loadedCache)
    }

    return movePieceToRunnable(moveData);
  })()
}

async function loadWeather(
  weatherPiece: SelectedPiece,
  downloadResults: RosterLockV1SyncDLResult["downloadResults"],
  loadedCache: LoadedCache,
): LoadedCache["weather"][string]{
  return loadedCache.weather[weatherPiece.id] ??= (async () => {
    const weatherDownload = downloadResults.weather[weatherPiece.id];
    if(!weatherDownload) throw new Error(`Missing download for weather "${weatherPiece.id}"`);
    return {};
  })()
}
