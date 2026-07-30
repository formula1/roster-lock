import { PieceSelectionSortPlugin } from "@roster-lock/types";
import { openUsageStore } from "./UsageStore";
import { forEachLogicId } from "./forEachLogicId";

const MostUsedTotal: PieceSelectionSortPlugin = {
  name: "most-used-total",
  publicInfo: {
    title: "Most Used (Total)",
    description: "Ranks pieces by how often anyone in the match - local or remote - has picked them.",
  },

  async sortPieces({ lockConfig, pieceType, dataDir }){
    const store = openUsageStore(dataDir);
    try {
      return store.topRanked(lockConfig.engine.name, pieceType);
    } finally {
      store.close();
    }
  },

  async handleFullSelection({ lockConfig, userSelections, dataDir }){
    const store = openUsageStore(dataDir);
    try {
      forEachLogicId(lockConfig, userSelections, Object.keys(userSelections), (pieceType, logicId)=>{
        store.increment(lockConfig.engine.name, pieceType, logicId);
      });
    } finally {
      store.close();
    }
  },

  // Usage is tracked entirely at selection time - nothing to do once a game finishes.
  async handleGameComplete(){},
};

export default MostUsedTotal;
