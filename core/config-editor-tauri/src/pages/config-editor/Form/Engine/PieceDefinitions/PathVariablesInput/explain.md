
Some pieces use common words in their asset paths however are different from piece to piece.

For example, in mugen characters, there are multiple asset paths that begin with the character's name. The spritesheet may be named `kfm.sff`, script named `kfm.cns` and definition file named `kfm.def` where `kfm` is the character name.

Meanwhile another character with the same files may be named `baiken.sff`, `baiken.cns` and `baiken.def`.

As such, we need a way to define a variable that can be used in the asset paths. This variable can then be used in the asset paths to define the character name without knowing the specific name ahead of time.

To use the variable in the asset globs, you can use the syntax `<variableName>`. For example, if you define a variable named `characterName`, you can use it in the asset paths like so: `<characterName>.sff`, `<characterName>.cns`, `<characterName>.def`.
