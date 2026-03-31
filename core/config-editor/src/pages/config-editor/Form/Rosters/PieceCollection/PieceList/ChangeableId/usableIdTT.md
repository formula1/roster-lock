# Id
The id is used to identify the piece. It is expected to be unique within a piece type though not globally.
Its primary use is for required pieces and selection metadata configurations.
I'd suggest using something memoral yet unique and clean for the id. For example, if a piece is a character, you could use the authors name with the character's name as the id such as `@author/character-name`.

# Usage With Required Pieces
If a piece requires another piece, the required piece is expected to use the id to identify it.
