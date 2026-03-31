/*
Global Variables accessible to the script

// This is psuedo random number generator based on seeds from all players during the commit/reveal step
// It returns a float between 0 and 1
RANDOM()

// This is a map of all the piece meta
// Normally only includes the current piece type and any "on demand" piece types that are required by the current piece type
// for globalValidation it includes all piece types after merging
// This is a getter as it will merge default meta with a piece's custom meta
PIECE_META.get(pieceType: string, pieceId: string): Meta

// The pieces available to be selected
// Normally only includes the current piece type and any "on demand" piece types that are required by the current piece type
// for globalValidation it includes all piece types after merging
PIECES_AVAILABLE: {
  [pieceType: string]: Array<PieceId>
}

type SelectedPiece = {
  // The id of the piece
  id: pieceId,
  // Whether the piece was selected or required by the piece config
  selected: "selected" | "required",
  // The "on demand" pieces that are required by this piece
  // Includes both the selected and the pieces defined in the piece's config
  required: Record<pieceType, Array<SelectedPiece>>,
}


// The pieces selected by the current player - only available during individual validation
PLAYER_SELECTION: Array<SelectedPiece>


// The pieces selected by each player - only available during merge algorithms
EACH_PLAYER_SELECTION: {
  [userId: string]: Array<SelectedPiece>
}

// The final merged selection - only available during globalValidation
FINAL_SELECTION: {
  // depending on the pieceType, it's either a list of pieces or a list of pieces per player
  [pieceType: string]: Array<SelectedPiece> | Record<userId, Array<SelectedPiece>>
}

*/
type RelativePath = string;
export type GasLimittedScript = (
  // I'm thinking a "published" config will be a tarball of all necessary files
  // This allows users to write scripts in their preferred editor then add them as necessary
  | {
    type?: string  // "text/lua",
    src: RelativePath,
  }
)
