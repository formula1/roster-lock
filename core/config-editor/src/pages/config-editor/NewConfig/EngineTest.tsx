
import { EngineTest } from "../Form";

import { useNewConfig } from "./data/Config";

export function NewEngineTest(){
  const { value } = useNewConfig();
  return <EngineTest config={value.stagedLock} />;
}
