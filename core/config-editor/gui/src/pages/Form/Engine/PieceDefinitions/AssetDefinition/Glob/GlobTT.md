Part of piece defintions is specifying what files should be in a piece.
For example a stage may have background music which can be an `.mp3` `.wav` or many other valid file types.
Another example is a character may have a spritesheet which is a `.png` or a `.webp` file.

To support these cases, you can use a "glob" to specify the valid file types.
A glob is a pattern that can match multiple file types.
For example, `*.mp3` will match all files that end with `.mp3`.
You can also specify multiple globs by separating them with a comma.
For example, `*.mp3,*.wav` will match all files that end with `.mp3` or `.wav`.

In addition, glob supports folder structure

You can learn more about globs
- [Quick refernce](https://code.visualstudio.com/docs/editor/glob-patterns)
- [Beginner's guide](https://www.malikbrowne.com/blog/a-beginners-guide-glob-patterns/)
- [Wiki](https://en.wikipedia.org/wiki/Glob_(programming)).

Something unique to **Roster Lock** is that we allow path variables in the glob.
For example, if you have a path variable named `characterName`, you can use it in the glob like so: `<characterName>.sff`.
This will match all files that start with the value of the `characterName` variable and end with `.sff`.
