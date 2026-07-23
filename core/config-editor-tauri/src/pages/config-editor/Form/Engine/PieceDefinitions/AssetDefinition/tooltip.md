Assets are one or more files that serve a singular purpose.
A single piece is expected to have multiple files. Each of these files are expected to serve a purpose.

For example, a character may have a spritesheet, a skeleton file and an animation file.

Each of these files serve a different purpose and should be defined as a seperate asset.

However, if a character has multiple spritesheets that serve the same purpose, they should be defined as a single asset.


### IMPORTANT - Asset Order Matters
If one asset's globs overlap with another asset's globs, the first asset will be chosen. Thus it is important to define or move assets in the correct order.
