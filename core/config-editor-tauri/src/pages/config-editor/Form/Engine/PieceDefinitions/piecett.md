## Piece Definitions
A game is expected to have one or more individual pieces. A piece is an interchangeable part of the game. For example, a fighting game may have characters and stages as pieces. Each character are interchangeable with one another but a character cannot be used as a stage and vice versa.

Each piece is, in part, defined by it's assets and each asset may use path variables.

### Assets
A piece is made up of one or more files. Each of these files serve a purpose and should be defined as a seperate asset.

For example, a character may have a spritesheet, a skeleton file and an animation file. Each of these files serve a different purpose and should be defined as a seperate asset. However, if a character has multiple spritesheets that serve the same purpose, they should be defined as a single asset.

### Path Variables
Some asset names use specific words in their file path however are different from piece to piece. For example, in mugen characters, there are multiple asset paths that begin with the character's name. The spritesheet may be named `kfm.sff`, script named `kfm.cns` and definition file named `kfm.def` where `kfm` is the character name. In this case, `kfm` should be defined as a path variable.