import JSON5 from "json5";
import { UntrustedConfig } from "@roster-lock/types";

const json5: UntrustedConfig = {
  name: "json5",
  extensions: [".json5"],
  async runConfig(configString: string){
    return JSON5.parse(configString);
  }
};

export default json5;
