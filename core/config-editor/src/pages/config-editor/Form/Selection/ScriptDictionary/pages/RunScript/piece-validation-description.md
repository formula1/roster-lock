The script will validate an individual user's piece selection.


# Globals
> Amoung the normally available globals are the following
- `pieceType: string`
- `selection: SelectedPiece[]`


# Expected Output
> The expected result should be one of the following
- `void` - If nothing is returned, it is considered a passes validation
- `valid: boolean`
- `[valid: boolean, reason: string]`
- `reason: string` - If a reason is passed, it is considered a failed validation
