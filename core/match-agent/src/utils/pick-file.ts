import { runCommand } from "./pick-folder";

// Native OS file-picker, spawned from match-agent itself rather than the
// browser - same reasoning as pick-folder.ts's NoFolderPickerAvailable:
// this only works when match-agent's own process has a display to show the
// dialog on, so a headless/remote match-agent should fail fast here rather
// than hang on a dialog nobody can see.
export class NoFilePickerAvailable extends Error {}

async function pickFileLinux(filterName: string, extension: string, startPath?: string): Promise<string | null> {
  const attempts: Array<[string, Array<string>]> = [
    [
      "zenity",
      [
        "--file-selection", `--file-filter=${filterName} | *${extension}`,
        ...(startPath ? [`--filename=${startPath}`] : []),
      ],
    ],
    ["kdialog", ["--getopenfilename", startPath || ".", `${filterName} (*${extension})`]],
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
  throw new NoFilePickerAvailable("No file-picker (zenity/kdialog) found on this host");
}

async function pickFileMac(extension: string, startPath?: string): Promise<string | null> {
  const script = startPath
    ? `POSIX path of (choose file with prompt "Select file" default location (POSIX file "${startPath}") ` +
      `of type {"${extension.replace(/^\./, "")}"})`
    : `POSIX path of (choose file with prompt "Select file" of type {"${extension.replace(/^\./, "")}"})`;
  try {
    const { code, stdout } = await runCommand("osascript", ["-e", script]);
    if (code !== 0) return null;
    return stdout.trim() || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoFilePickerAvailable("osascript not found on this host");
    }
    throw e;
  }
}

async function pickFileWindows(filterName: string, extension: string, startPath?: string): Promise<string | null> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = ${JSON.stringify(`${filterName} (*${extension})|*${extension}`)}
    ${startPath ? `$dialog.InitialDirectory = ${JSON.stringify(startPath)}` : ""}
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      Write-Output $dialog.FileName
    }
  `;
  try {
    const { code, stdout } = await runCommand("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
    if (code !== 0) return null;
    return stdout.trim() || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoFilePickerAvailable("powershell not found on this host");
    }
    throw e;
  }
}

// Returns the picked absolute path, or null if the user cancelled the
// dialog. Throws NoFilePickerAvailable if this host has no way to show one
// at all (headless Linux with neither zenity nor kdialog, etc).
export function pickFile(filterName: string, extension: string, startPath?: string): Promise<string | null> {
  if (process.platform === "darwin") return pickFileMac(extension, startPath);
  if (process.platform === "win32") return pickFileWindows(filterName, extension, startPath);
  return pickFileLinux(filterName, extension, startPath);
}
