# Welcome to RosterLock Config Editor!

RosterLock Config Editor is a tool for managing RosterLock configurations. RosterLock is a system for managing game assets that might be great in number but only need a few at a time. RosterLock Config Editor allows you to create and manage RosterLock configurations for your game.

# Purposes

## Engine
If you are a game engine developer, you can use the RosterLock Config Editor to create an engine configuration. This engine configuration gives you the tools to create validation for complex piece folder structures. If your game has interchangable pieces such as characters or stages, they likely are more than just a single file. MatchLock allows you to define `Piece Defintions` which should handle the validation of these complex folder structures.


## Roster
If you are a game enthusiast, you can use the RosterLock Config Editor to create and manage lists of rosters. Games that allow user content are may have 100s or more available pieces to work with. By creating a roster restriction, you give players a way to play against eachother with a restricted list. If you enjoy testing characters and creating rosters bigger than a player can handle at once, you can create a roster that includes all the characters you want included.


## Selection
Different games have different ways of selecting pieces. For stages, it's common for each player to select a stage and the stage with the most votes is used, or a random stage is selected if there's a tie. For tag team fights, it's common for each player to select multiple of their own characters. We allow you to define `Selection Configurations` which should handle the validation of these complex selection rules. We run untrusted scripts in a sandboxed environment to ensure that the scripts cannot access your system.

