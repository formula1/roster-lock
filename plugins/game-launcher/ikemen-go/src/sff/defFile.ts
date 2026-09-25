// Minimal MUGEN/Ikemen .def (INI-like) key reader - just enough to look up
// which .sff a piece's own .def file names, since that's author-chosen and
// not reliably the same base name as the .def itself (a character's .def has
// `[Files]`/`sprite = <name>.sff`, a stage's has `[BGdef]`/`spr = <name>.sff`
// - confirmed against this repo's own pieces/chars/kfm/kfm.def and
// pieces/stages/stage0/stage0.def fixtures). Not a full def parser.

// Strips ";"-comments (naively - fine for the [section]/key = value lines
// this is ever asked to read, none of which contain a literal ";" in
// practice), finds `[section]` case-insensitively, then the first
// `key = value` inside it, returning the value with surrounding quotes
// stripped.
export function readDefKey(defContents: string, section: string, key: string): string | undefined {
  let inSection = false;
  for (const rawLine of defContents.split(/\r?\n/)) {
    const line = rawLine.split(";")[0].trim();
    if (!line) continue;
    const sectionMatch = /^\[(.+)\]$/.exec(line);
    if (sectionMatch) {
      inSection = sectionMatch[1].trim().toLowerCase() === section.toLowerCase();
      continue;
    }
    if (!inSection) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim().toLowerCase() !== key.toLowerCase()) continue;
    return line.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return undefined;
}
