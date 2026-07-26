import { RosterLockV1Config, RosterLockV1Draft } from "@roster-lock/types";
import { bufferToStr, createShaFromBuffer } from "@roster-lock/utils";
import { HostFunctions } from "../../../../../../globals/Host";
import { collectStream } from "../../../../../../utils/walk";

type ScriptDictionary = RosterLockV1Config["selection"]["scriptDictionary"];
type ScriptInfo = RosterLockV1Draft["draft"]["selectionScriptInfo"];


export async function loadFolder(host: HostFunctions){
  if(!host.walkDir) throw new Error("This host cannot open folders");
  const walked = await host.walkDir(undefined, { title: "Load Script Folder" });
  if(!walked) return;

  const lastLoad = Date.now();
  const files: ScriptDictionary = {};
  const info: ScriptInfo = {};
  const promises: Array<Promise<any>> = []
  for await (const entry of walked.entries){
    promises.push(Promise.resolve().then(async ()=>{
      const contentRaw = await collectStream(entry.loadFile());
      files[entry.relativePath] = {
        content: bufferToStr(contentRaw as Uint8Array<ArrayBuffer>)
      }
      const sha = await createShaFromBuffer(contentRaw);
      info[entry.relativePath] = {
        lastLoad, sha, referencePath: entry.fileToken
      }
    }))
  }
  await Promise.all(promises)

  return { folder: walked.folderToken, files, info }
}
