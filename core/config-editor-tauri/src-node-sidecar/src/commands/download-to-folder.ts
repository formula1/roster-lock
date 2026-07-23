import {
  downloadToFolder
} from "@roster-lock/plugin-runtime";

export async function downloadToFolderCommand(
  pluginDir: string,
  url: string,
  destinationFolder: string
) {
  try {
    
    console.log("Testing download source:", url, " to ", destinationFolder);
    
    const abortController = new AbortController();
    const result = await downloadToFolder(
      pluginDir, {
        url,
        destinationFolder,
        processHandlers: { abortSignal: abortController.signal }
      }
    );
    
    await result.finishPromise;
    
    process.exitCode = 0;
  } catch (error) {
    console.error("❌ Download test failed:", error);
    process.exitCode = 1;
  }
}
