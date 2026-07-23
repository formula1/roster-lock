Shared pieces are single lists that all players share. It involves an algorithm that takes in all players choices and returns a single set of choices. Shared pieces require a merge script.

### Example
In a fighting game usually there will be a stage selected. Each player can suggest a stage but only one stage will be chosen. The algorithm used to choose the stage is defined in the selection config.

---

**Note**: A validation script can be used to validate a player's individual selection. For example, if a game requires each player to select a unique stages, a validation script can be used to check for duplicates.

**Note**: A merge script will be used to overwrite all player's selections. A merge script takes in each player's choices and returns a single set of choices.

**Note**: The amount of choices returned by the merge script doesn't have to match the amount of choices each player selected. For example, if each player selected 3 stages but the merge script returns 1 stages, then only 1 stage will be downloaded. If each player selected 1 stage but the merge script returns 3 stages, then all 3 stages will be downloaded.
