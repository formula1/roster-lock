import { PieceSelectionSortPlugin } from "@roster-lock/types";
import { openWinRateStore } from "./WinRateStore";
import { forEachLogicId } from "./forEachLogicId";

const HighestWinrateLocally: PieceSelectionSortPlugin = {
  name: "highest-winrate-locally",
  publicInfo: {
    title: "Highest Winrate (Locally)",
    description: "Ranks pieces by how often you win with them.",
  },

  async sortPieces({ lockConfig, pieceType, dataDir }){
    const store = openWinRateStore(dataDir);
    try {
      return store.topRanked(lockConfig.engine.name, pieceType);
    } finally {
      store.close();
    }
  },

  async handleFullSelection({ lockConfig, localUsers, userSelections, dataDir }){
    const store = openWinRateStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, localUsers, (pieceType, logicId)=>{
        store.recordGame(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },

  async handleGameComplete({ lockConfig, localUsers, userSelections, winners, dataDir }){
    const winnersSet = new Set(winners);
    const localWinners = localUsers.filter((userId)=>winnersSet.has(userId));
    if(localWinners.length === 0) return;

    const store = openWinRateStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, localWinners, (pieceType, logicId)=>{
        store.recordWin(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },
};

export default HighestWinrateLocally;
