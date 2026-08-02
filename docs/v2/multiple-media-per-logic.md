
# Multiple Media Per Logic

I want to be able to support customized skins for characters beyond just a pallete swap. It would be nice if they can be added to the roster config for users to select.

### Deferred
- Personal/Local-only overrides
  - a skin only the selecting user sees, never shared with the opponent's client
  - local rendering only, no sync/validation concerns, revisit later.
- Override Layering
  - in case a player wants to use the sound from one override and the skins from another

# Config
- Users can generate a **partial** mediaOverride
  - Only provide sounds, only provide texture, only provide 3d model
  - Ther override should indicate the asset names that it will be overriding
    - core/types/src/v1/lock/engine.ts EngineAssetDefinition
  - Create a media-info for easy addition
    - similar to the piece-info - core/types/src/v1/metadata.ts
    - should update the files to ignore - core/shared/src/match-lock-file/match-config/version-1/usage/files-and-assets/constants.ts

```typescript
// Sha256 is for downloading validation
type MediaOverride = Record<Sha256, {
  name: string,
  assets: Array<string>
  downloadSources: Array<DownloadableSource>
}>
```

# Sharing
- Roster lock items can provide `mediaOverride` list for **legal** skins
- When sending selection, a user can select a valid mediaOverride from one in the roster

# Downloading
- Downloading a `mediaOverride` require it's own schema/folder
  - index by `(engineType, pieceType, logic)`
  - Should use the same download algorithm used by pieces
  - Needs to be validated after downloading
    - Validate the file structure using assets based in the engine config
    - Create a version sha based on the files

# Using
- When reading media files
  - client/typescript/src/v1/file-routes.ts (getPieceAssetFiles, getPieceFileContents)
  - Check if the file is related to media or logic
    - If logic - go as normal
  - check if the file is related to one of the asset types overriding
    - If no -  go as normal
  - check the `mediaOverride` folder
    - If its not there - we should probably fail rather then going as normal


# Continue
Instead of the mediaOverrides being it's own property onthe root, I think it should be an optional property added to the RosterLockPiece

I'm thinking multiple overrides can be used so long as the assets dont conflict


We should also make sure that any files in the overrides