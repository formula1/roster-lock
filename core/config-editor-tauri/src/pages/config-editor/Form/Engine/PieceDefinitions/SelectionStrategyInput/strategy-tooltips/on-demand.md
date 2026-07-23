On Demand pieces are only downloaded if required by another piece. They are not selected by the player and are not configurable.

On Demand pieces can require other piece types. This allows for complex piece relationships to be defined.
At the moment, only on demand pieces can be required. A mandatory, personal or shared piece cannot be required by another piece type.

### Example
If there is a `move` piece type and a `character` piece type and the `character` piece type requires some items from `move` piece type then the `move` would be considered on demand.

---

**Note**: On demand pieces are not selectable. They are only downloaded if required by another piece.

**Note**: On demand pieces can require other on demand pieces. This creates a dependency chain that is downloaded in order.

**Note**: On demand pieces can create a dependency cycle. For example, if `chicken` requires `egg` and `egg` requires `chicken` then a dependency cycle is created. This will be detected and rejected.
