import {
  downloadToFolder as nodeServicesDownloadToFolder,
  SOURCE_HANDLERS
} from '@roster-lock/node-services';

export const SUPPORTED_PROTOCOLS = SOURCE_HANDLERS.map(handler => handler.protocols).flat();

export async function downloadToFolder(
  url: string,
  destinationFolder: string
) {
  try {
    
    console.log('Testing download source:', url, ' to ', destinationFolder);
    
    const abortController = new AbortController();
    const result = await nodeServicesDownloadToFolder(
      url, destinationFolder, { abortSignal: abortController.signal }
    );
    
    await result.finishPromise
    
    process.exitCode = 0;
  } catch (error) {
    console.error('❌ Download test failed:', error);
    process.exitCode = 1;
  }
}
