The script will merge all users selection to either another user selection map or a single shared array.
This is useful for pieces like stages where each user chooses their own but a single item or list would be used by all users

Among the normal globals
- `users: string[]`
- `pieceType: string`
- `selection: { [userId: string]: SelectedPiece[] }`

# Expected Output

> If the selection strategy is `shared`, the expected output should be the following
- `SelectedPiece[]`

> If the selection strategy is `personal`, the expected output should be the following
- `{ [userId: string]: SelectedPiece[] }`
