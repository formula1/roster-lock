import { Command } from '@tauri-apps/plugin-shell';
import type { ScriptStarter } from '@roster-lock/shared';

type OutputLine = { source: "out" | "err", content: string };

export const ROSTERLOCK_SIDECAR = {
  downloadSource: async function(url: string, destinationFolder: string): Promise<void> {
    const instance = Date.now().toString(32);
    const command = Command.sidecar(
      'binaries/node-sidecar', [
        'download-to-folder',
        '--input-url', url,
        '--output-folder', destinationFolder
      ]
    );
    command.stdout.on('data', line => console.log("sidecar stdout", instance +":", line));
    command.stderr.on('data', line => console.log("sidecar stderr", instance +":", line));

    const output = await command.execute();

    if (output.code !== 0) {
      throw new Error(output.stderr);
    }
  },

  runScript: async function(scriptConfig: ScriptStarter): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const log: Array<OutputLine> = [];
      const instance = Date.now().toString(32);
      const command = Command.sidecar('binaries/node-sidecar', ['run-script']);

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
            resolve(JSON.parse(stdout));
          } catch {
            reject(new Error('Failed to parse script result: ' + stdout));
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

class ProcessError extends Error {
  constructor(public code: number, public log: Array<OutputLine>){
    super("Process Error: " + code)
  }
}