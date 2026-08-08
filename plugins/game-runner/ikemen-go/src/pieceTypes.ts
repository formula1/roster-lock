// The names an Ikemen GO roster-lock engine config is expected to use for its
// two pieceDefinitions entries. Not something this plugin can discover on its
// own - RosterLockEngineConfig.pieceDefinitions keys are arbitrary strings
// chosen by whoever wrote the engine config, so this is a convention the
// Ikemen engine config and this plugin have to agree on out of band.
export const CHARACTER_PIECE_TYPE = "character";
export const STAGE_PIECE_TYPE = "stage";

// The pathVariables key naming a piece's .def file, minus the extension - so
// `{ defName: "kfm" }` means the piece folder holds `kfm.def`. Same convention
// as the piece type names above: the engine config declares `defName` in its
// pieceDefinitions[...].pathVariables and every roster piece supplies a value.
//
// This can't be inferred from the download folder. match-agent names piece
// folders with a ULID (SQLFolderDB's ensurePieceExists), so the folder never
// carries the character's name, and a folder holds more than one .def anyway -
// a character's `intro`/`ending`/`arcadepath`/`ratiopath` storyboards are
// themselves .def files sitting next to the character's own (Ikemen resolves
// them out of the char def, relative to its directory). Globbing *.def would
// have to guess between them.
export const DEF_NAME_VARIABLE = "defName";

// Ikemen's MaxSimul (src/system.go), which is also what the -p1..-p8 Quick-VS
// flags allow once slots are split across two sides. Turns mode can exceed
// MaxSimul internally, but not through these flags, so this caps every mode.
export const MAX_CHARACTERS_PER_SIDE = 4;
