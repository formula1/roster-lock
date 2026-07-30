import { UntrustedConfig } from "@roster-lock/types";

const json: UntrustedConfig = {
  name: "json",
  extensions: [".json"],
  async runConfig(configString: string){
    return JSON.parse(configString);
  }
};

export default json;
