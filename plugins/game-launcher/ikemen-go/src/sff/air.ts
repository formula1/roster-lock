// Minimal .air (animation) reader - just enough to play one action back.
//
// A character's .air file (named by [Files]/anim in its .def) defines every
// animation as `[Begin Action <n>]` followed by one line per frame:
//
//   group, number, xoffset, yoffset, ticks [, flip [, blend]]
//
// interleaved with collision boxes (Clsn*) and loop markers this doesn't care
// about. Action 0 is the standing/idle animation by MUGEN convention - see
// examples/mugen/pieces/chars/kfm/kfm.air, which is what every rule below was
// checked against.

export type AirFrame = {
  group: number,
  number: number,
  offsetX: number,
  offsetY: number,
  // Display time in MUGEN ticks (60 per second). -1 means "hold forever",
  // which is how an animation says it doesn't loop.
  ticks: number,
  flipX: boolean,
  flipY: boolean,
};

// `;` starts a comment that runs to end of line - the file is otherwise
// whitespace-insensitive.
function stripComment(line: string): string {
  const index = line.indexOf(";");
  return (index === -1 ? line : line.slice(0, index)).trim();
}

function isActionHeader(line: string, action?: number): boolean {
  const match = /^\[\s*begin\s+action\s+(-?\d+)\s*\]$/i.exec(line);
  if (!match) return false;
  return action === undefined || Number(match[1]) === action;
}

// Everything in an action block that isn't a frame: collision boxes and their
// `Clsn2Default: 2` headers, loop markers, and interpolation directives.
function isNonFrameDirective(line: string): boolean {
  return /^(clsn\d?(default)?\b|loopstart\b|interpolate\b)/i.test(line);
}

function parseFrame(line: string): AirFrame | undefined {
  const parts = line.split(",").map((part) => part.trim());
  if (parts.length < 5) return undefined;
  const [group, number, offsetX, offsetY, ticks] = parts.slice(0, 5).map(Number);
  if ([group, number, offsetX, offsetY, ticks].some((value) => !Number.isInteger(value))) return undefined;
  // The optional 6th field is the flip flag ("H", "V", "HV"); a 7th is a
  // blend mode (A, S, AS128D128, ...) that a still preview can't honour.
  const flip = (parts[5] ?? "").toUpperCase();
  return {
    group, number, offsetX, offsetY, ticks,
    flipX: flip.includes("H"),
    flipY: flip.includes("V"),
  };
}

// Returns the frames of one action, or undefined if the file has no such
// action. An action present but holding no frame lines also reads as
// undefined - there's nothing to play either way.
export function readAction(contents: string, action: number): Array<AirFrame> | undefined {
  const lines = contents.split(/\r?\n/).map(stripComment);
  const start = lines.findIndex((line) => isActionHeader(line, action));
  if (start === -1) return undefined;

  const frames: Array<AirFrame> = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("[")) break; // next section - the action is over
    if (line === "" || isNonFrameDirective(line)) continue;
    const frame = parseFrame(line);
    // A line that's neither a directive nor a valid frame is something this
    // reader doesn't know; skipping beats throwing, since one odd line
    // shouldn't cost a character its whole preview.
    if (frame) frames.push(frame);
  }
  return frames.length > 0 ? frames : undefined;
}
