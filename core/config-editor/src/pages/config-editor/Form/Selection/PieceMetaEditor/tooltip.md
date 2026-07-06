Extra information can be retrieved within a script on a per piece level

> `getPieceMeta(pieceType, pieceId)`

This is useful for situations where pieces will be validated based on a common meta value. For example a `fire` character cannot use `water` moves. You can add a meta key `element` than can be one or more values.