
import { resolve } from "path";
import { readFile } from "node:fs/promises"
import { parseText } from "./log-parser";

export async function handleLog(logFile: string){
  const contents = await readFile(logFile, "utf8");
  return parseText(contents);
}


if (require.main === module) {
  Promise.resolve().then(async ()=>{
    // ./docs/abc123-host.host-win.txt
    // ./docs/abc123-host.leave.txt
    const luaFile = resolve(__dirname, "../../", "./docs/abc123-host.host-win.txt");
    const result = await handleLog(luaFile)
    console.log(JSON.stringify(result, null, 2));
  })
}

