#### You have Files that are not picked up by any Asset definition

> This is an issue because your engine doesn't expect these files to be present.
> While we can ignore them, it's possible that the file is necessary for the piece to work correctly.
> In which case, you should update the engine to include the file in a asset definition.

**Possible Reasons**

- In the engine, the related piece definition's asset globs are incorrect and did not match this file
- the file shouldn't be in this folder


#### Single Player related Content expected to be Removed
If this file is related to single player content, you are expected to remove it from the folder.
At the moment, RosterLock does not support ignoring files.
Either the file is useful for multiplayer and should be included in an asset definition or it should be removed.
