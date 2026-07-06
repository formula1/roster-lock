import { Command } from '@tauri-apps/plugin-shell';
import type { ScriptStarter } from '@roster-lock/types';
import { JSON_Unknown } from '@roster-lock/utils';

type OutputLine = { source: "out" | "err", content: string };

type PluginInfo = { name: string, package: { name: string, version: string } };

export const ROSTERLOCK_SIDECAR = {
  getDownloadPlugins: async (pluginDir: string)=>{
    return await runSidecar([
      'get-download-plugins',
      pluginDir,
    ]) as {
      protocol: Array<PluginInfo>,
      decompressor: Array<PluginInfo>,
      archive: Array<PluginInfo>
    };
  },
  matchDownloadProtocols: async (pluginDir: string, url: string)=>{
    return await runSidecar([
      'match-download-protocol',
      pluginDir,
      url,
    ]) as Array<PluginInfo>;
  },
  downloadSource: async function(pluginDir: string, url: string, destinationFolder: string) {
    const log: Array<OutputLine> = [];
    const command = Command.sidecar(
      'binaries/node-sidecar', [
        'download-to-folder',
        pluginDir,
        '--input-url', url,
        '--output-folder', destinationFolder
      ]
    );
    command.stdout.on('data', line => log.push({ source: "out", content: line }));
    command.stderr.on('data', line => log.push({ source: "err", content: line }));

    const output = await command.execute();

    if (output.code !== 0 && output.code !== null) {
      throw new ProcessError(output.code, log);
    }
    return { log }
  },

  getScriptPlugins: async function(pluginDir: string){
    return await runSidecar([
      'get-untrusted-script-plugins',
      pluginDir,
    ]) as Array<PluginInfo & { extensions: Array<string> }>
  },

  runScript: async function(pluginDir: string, scriptConfig: ScriptStarter): Promise<{ debugLog: Array<string>, status: "success" | "fail", result: JSON_Unknown }> {
    return new Promise((resolve, reject) => {
      const log: Array<OutputLine> = [];
      const instance = Date.now().toString(32);
      const command = Command.sidecar('binaries/node-sidecar', ['run-script', pluginDir]);

      let stdout = '';

      command.stdout.on('data', line => log.push({ source: "out", content: line }));
      command.stderr.on('data', line => log.push({ source: "err", content: line }));
      command.stdout.on('data', (line: string) => {
        stdout += line;
      });
      command.on('close', (data: { code: number | null }) => {
        if (data.code !== 0 && data.code !== null) {
          reject(new ProcessError(data.code, log));
        } else {
          try {
            let result;
            try {
              result = JSON.parse(stdout)
            } catch(e) {
              throw new Error('Failed to parse script result: ' + stdout);
            }
            if(!Array.isArray(result.debugLog)){
              throw new Error("debugLog is expected to be an array of strings");
            }
            for(const line of result.debugLog){
              if(typeof line !== "string"){
                throw new Error("debugLog is expected to be an array of strings")
              }
            }
            if(!["success", "fail"].includes(result.status)){
              throw new Error("status should be success or fail")
            }
            if(!("result" in result)){
              throw new Error("there should be a result")
            }
            resolve(result);
          }catch(e){
            reject(e)
          }
        }
      });
      command.on('error', (error: unknown) => reject(new Error(String(error))));

      command.spawn().then(child => {
        child.write(JSON.stringify(scriptConfig) + '\0').catch(reject);
      }).catch(reject);
    });
  },
};

export class ProcessError extends Error {
  constructor(public code: number, public log: Array<OutputLine>){
    super("Process Error: " + code)
  }
}

async function runSidecar(args: Array<string>){
  let stdout = '';
  const log: Array<OutputLine> = [];
  const command = Command.sidecar(
    'binaries/node-sidecar', args
  );
  command.stdout.on('data', line => log.push({ source: "out", content: line }));
  command.stderr.on('data', line =>{
    log.push({ source: "err", content: line })
    stdout += line;
  });

  const output = await command.execute();

  if (output.code !== 0 && output.code !== null) {
    throw new ProcessError(output.code, log);
  }

  return JSON.parse(stdout)
}

