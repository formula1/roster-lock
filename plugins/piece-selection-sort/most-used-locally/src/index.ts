import { PieceSelectionSortPlugin } from "@roster-lock/types";
import { openUsageStore } from "./UsageStore";
import { forEachLogicId } from "./forEachLogicId";

const MostUsedLocally: PieceSelectionSortPlugin = {
  name: "most-used-locally",
  publicInfo: {
    title: "Most Used (Locally)",
    description: "Ranks pieces by how often you've picked them on this machine.",
  },

  async sortPieces({ lockConfig, pieceType, dataDir }){
    const store = openUsageStore(dataDir);
    try {
      return store.topRanked(lockConfig.engine.name, pieceType);
    } finally {
      store.close();
    }
  },

  async handleFullSelection({ lockConfig, localUsers, userSelections, dataDir }){
    const store = openUsageStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, localUsers, (pieceType, logicId)=>{
        store.increment(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },

  // Usage is tracked entirely at selection time - nothing to do once a game finishes.
  async handleGameComplete(){},
};

export default MostUsedLocally;
