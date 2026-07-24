import { PieceSelectionSortPlugin } from "@roster-lock/types";
import { openWinRateStore } from "./WinRateStore";
import { forEachLogicId } from "./forEachLogicId";

const HighestWinrateTotal: PieceSelectionSortPlugin = {
  name: "highest-winrate-total",
  publicInfo: {
    title: "Highest Winrate (Total)",
    description: "Ranks pieces by how often anyone in the match - local or remote - wins with them.",
  },

  async sortPieces({ lockConfig, pieceType, dataDir }){
    const store = openWinRateStore(dataDir);
    try {
      return store.topRanked(lockConfig.engine.name, pieceType);
    } finally {
      store.close();
    }
  },

  async handleFullSelection({ lockConfig, userSelections, dataDir }){
    const store = openWinRateStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, Object.keys(userSelections), (pieceType, logicId)=>{
        store.recordGame(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },

  async handleGameComplete({ lockConfig, userSelections, winners, dataDir }){
    if(winners.length === 0) return;

    const store = openWinRateStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, winners, (pieceType, logicId)=>{
        store.recordWin(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },
};

export default HighestWinrateTotal;
