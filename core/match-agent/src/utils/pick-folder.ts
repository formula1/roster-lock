import { spawn } from "node:child_process";

// Native OS folder-picker, spawned from match-agent itself rather than the
// browser - a plain <input> can never hand back an absolute filesystem path
// (browser security), and binaryLocation is specifically a folder (see
// docs/v2/binary-location.md), not a single file a file input could even
// approximate. This only works when match-agent's own process has a display
// to show the dialog on (the ordinary case: match-agent and the browser
// hitting it are on the same desktop machine) - a headless/remote match-agent
// should fail fast here so the caller falls back to manual text entry rather
// than hanging on a dialog nobody can see.
export class NoFolderPickerAvailable extends Error {}

function runCommand(command: string, args: Array<string>): Promise<{ code: number | null, stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout }));
  });
}

// zenity/kdialog exit 1 on cancel (empty stdout); osascript throws on
// cancel; the PowerShell script below prints nothing on cancel. All three
// are treated the same way: null means "cancelled", not an error.
async function pickFolderLinux(startPath?: string): Promise<string | null> {
  const attempts: Array<[string, Array<string>]> = [
    ["zenity", ["--file-selection", "--directory", ...(startPath ? [`--filename=${startPath}/`] : [])]],
    ["kdialog", ["--getexistingdirectory", startPath || "."]],
  ];

  for (const [command, args] of attempts) {
    try {
      const { code, stdout } = await runCommand(command, args);
      if (code !== 0) return null;
      return stdout.trim() || null;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      // Tool not installed - fall through to the next one.
    }
  }
  throw new NoFolderPickerAvailable("No folder-picker (zenity/kdialog) found on this host");
}

async function pickFolderMac(startPath?: string): Promise<string | null> {
  const script = startPath
    ? `POSIX path of (choose folder with prompt "Select folder" default location (POSIX file "${startPath}"))`
    : `POSIX path of (choose folder with prompt "Select folder")`;
  try {
    const { code, stdout } = await runCommand("osascript", ["-e", script]);
    if (code !== 0) return null;
    return stdout.trim() || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoFolderPickerAvailable("osascript not found on this host");
    }
    throw e;
  }
}

async function pickFolderWindows(startPath?: string): Promise<string | null> {
  // FolderBrowserDialog rather than a raw file dialog - matches what
  // binaryLocation actually is. Printed path (if any) is the only stdout.
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    ${startPath ? `$dialog.SelectedPath = ${JSON.stringify(startPath)}` : ""}
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $dialog.SelectedPath
    }
  `;
  try {
    const { code, stdout } = await runCommand("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
    if (code !== 0) return null;
    return stdout.trim() || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoFolderPickerAvailable("powershell not found on this host");
    }
    throw e;
  }
}

// Returns the picked absolute path, or null if the user cancelled the
// dialog. Throws NoFolderPickerAvailable if this host has no way to show
// one at all (headless Linux with neither zenity nor kdialog, etc).
export function pickFolder(startPath?: string): Promise<string | null> {
  if (process.platform === "darwin") return pickFolderMac(startPath);
  if (process.platform === "win32") return pickFolderWindows(startPath);
  return pickFolderLinux(startPath);
}
