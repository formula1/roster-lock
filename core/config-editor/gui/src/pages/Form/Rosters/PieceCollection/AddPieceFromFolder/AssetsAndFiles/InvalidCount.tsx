import { PieceDefinition } from "../../types";


export function InvalidCount(
  { asset }: { asset: PieceDefinition["assets"][number] }
){
  if(!Array.isArray(asset.count)){
    if(asset.count === "*") return null;
    return <div className="error">Expecting exactly {asset.count} files</div>
  }
  if(asset.count[1] === "*"){
    return <div className="error">Expecting at least {asset.count[0]} files with no maximum</div>
  }
  return <div className="error">Expecting between {asset.count[0]} and {asset.count[1]} files</div>
}
