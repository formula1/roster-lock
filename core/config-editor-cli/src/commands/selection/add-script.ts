import { Command } from "commander";
import { statSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { bufferToStr, createShaFromBuffer } from "@roster-lock/utils";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { walkRelative } from "../../lib/fs-walk";

export const addScriptCommand = withDraftOption(new Command("add-script"))
  .description("Add one or more selection scripts (a single file, or every file in a folder) to the staged lock")
  .argument("<fileOrFolder>", "path to a single script file, or a folder of script files")
  .option("--key <relPath>", "script key to use when adding a single file (defaults to its basename)")
  .action(withErrorHandling(async (fileOrFolder: string, opts: { draft?: string, key?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const target = resolve(process.cwd(), fileOrFolder);
    const stats = statSync(target);
    const lastLoad = Date.now();

    const entries: Array<{ key: string, absolutePath: string }> = [];
    if(stats.isDirectory()){
      for await (const relativePath of walkRelative(target)){
        entries.push({ key: relativePath, absolutePath: resolve(target, relativePath) });
      }
    } else {
      entries.push({ key: opts.key ?? basename(target), absolutePath: target });
    }

    for(const { key, absolutePath } of entries){
      const contentRaw = readFileSync(absolutePath);
      const content = bufferToStr(contentRaw);
      const sha = await createShaFromBuffer(contentRaw);

      draft.stagedLock.selection.scriptDictionary[key] = { content };
      draft.draft.selectionScriptInfo[key] = { lastLoad, sha, referencePath: absolutePath };
    }

    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);
    writeDraft(draftPath, draft);
    console.log(`Added ${entries.length} script(s): ${entries.map((e) => e.key).join(", ")}`);
  }));
