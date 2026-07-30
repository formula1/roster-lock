The asset classification is important for versioning.


- `Document` changes don't effect the character and thus don't require a version bump.
- `Media` changes require a patch version bump as they don't generally change the balance of the character, just what the user sees or hears.
- `Logic` changes require a major version bump as they can change the balance of the character.


MatchLock collects the hash of all the `Logic` files to identify a character allowing changes to `media` and `document` files without redownloading the character.


If you are unsure of what a asset type should be, choosing `Logic` is the safest bet.