# Required Pieces

If a piece requires another piece, the required piece is expected to use the id to identify it.

You may directly set the pieces that are expected to be downloaded.
You may also allow the required piece to be selected by the user. This is useful if the required piece is not yet available.

**Note**: If you allow the required piece to be selected by the user, you should add validation in the selection config to prevent users from selecting every possible piece.
