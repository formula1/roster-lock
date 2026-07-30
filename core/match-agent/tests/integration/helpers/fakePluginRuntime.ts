import { IPluginManager, IPieceSort } from "@roster-lock/plugin-runtime";

export class FakePluginManager implements IPluginManager {
  readonly pluginDir = "hello-world";
  pieceSort = new FakePieceSort()
  uninstallPlugin(): ReturnType<IPluginManager["uninstallPlugin"]>{
    throw new Error("Not implemented");
  }
  setPluginPriority(): ReturnType<IPluginManager["setPluginPriority"]>{
    throw new Error("Not implemented");
  }
  getPluginPackagesOfType(): ReturnType<IPluginManager["getPluginPackagesOfType"]>{
    throw new Error("Not implemented");
  }
  getPluginFullOfType(): ReturnType<any>{
    throw new Error("Not implemented");
  }
  installPlugin(): ReturnType<IPluginManager["installPlugin"]>{
    throw new Error("Not Implemented");
  }
  updatePlugin(): ReturnType<IPluginManager["updatePlugin"]>{
    throw new Error("Not Implemented");
  }
  downloadToFolder(): ReturnType<IPluginManager["downloadToFolder"]>{
    throw new Error("Not Implemented");
  }
  runUntrustedScript(): ReturnType<IPluginManager["runUntrustedScript"]>{
    throw new Error("Not Implemented");
  }
}

class FakePieceSort implements IPieceSort {
  constructor(){}
  listAvailable(): ReturnType<IPieceSort["listAvailable"]>{
    throw new Error("No implmented");
  }
  sortPieces(): ReturnType<IPieceSort["sortPieces"]>{
    throw new Error("No implmented");
  }
  handleFullSelection(): ReturnType<IPieceSort["handleFullSelection"]>{
    throw new Error("No implmented");
  }
  handleGameComplete(): ReturnType<IPieceSort["handleGameComplete"]>{
    throw new Error("Not Implmented")
  }
}