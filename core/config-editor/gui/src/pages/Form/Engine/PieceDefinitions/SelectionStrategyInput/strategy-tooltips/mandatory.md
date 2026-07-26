Mandatory pieces are always downloaded. They are not selected by the player and are not configurable.

### Example

An Example of a mandatory piece is if a game engine supports 3v3, tag team or multiple characters at once but they each use different global scripts to run. We'll call this mandatory piece type `global-team-script`.

If a roster was created with tag team in mind and a tag team team global script is necessary then that script would be a mandatory piece added to the `global-team-script`.
If a roster was created with 3v3 in mind and a 3v3 team global script is necessary then that script would be a mandatory piece added to the `global-team-script`.
If no global script is necessary, then a mandatory piece wouldn't be added to the roster.

---

**Note**: Multiple mandatory pieces in a single piece definition are allowed. For example, if multiple global scripts are necessary, they can all be added to the `global-team-script` piece definition.

**Note**: While a game may support a mandatory piece, it is not required. For example, if a game supports tag team but doesn't require it, then a roster without a tag team global script is valid.

**Note**: Each mandatory piece in a single piece definition are expected to be loaded by the game the same way. If one mandatory piece would be global script while another would be life bars, they should be split into two piece definitions both with the mandatory strategy.
