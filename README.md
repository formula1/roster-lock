# Roster Lock

## Purpose

### Piece Restriction as a Service
Some characters are absurdely overpowered compared to their counter parts. In games that allow user generated content, allowing players to choose any character they want may result in poor gameplay. While fairness in powerlevel is relative to the other characters available, a restriction configuration can be used to make sure matches are more fair. The testing and vetting of characters now becomes a service and can provide players a better experience.

1. Create a restriction configuration
2. Add pieces to the restriction configuration (Minor version change)
  - multiple versions of the same character are allowed
3. Remove pieces from the restriction configuration (Major version change)
4. Update pieces in the restriction configuration
  - If only media files change, update a patch version (no redownload necessary)
  - If one or more logic files change, update the major version (Consider old one removed and updated one as a new character)
5. Sign the restriction configuration to make sure it hasn't been tampered with



### Too many Pieces
As the number of possible selectable game pieces (such as characters and stages) increases, the ability for a player to download all of them ahead of time becomes a problem. By only downloading the pieces they need for a specific match, the amount of data that needs to be downloaded is reduced.

Thats where Roster Lock comes in. Roster lock has a few steps
- Engine Lock - specify PieceTypes which are the file structure of "Legal" pieces. An engine can have multiple PieceTypes such as Characters and Stages
- Restriction Lock - Collections with their own rules for selection, the PieceType of the collection, all the pieces that can be used and where to download them
- Selection - Recieving a player's choices from the client Game, relaying to other players using commit/reveal (to prevent counter picking), validating player's choices and running any choice algorithms like democracy or random
- Usage - Downloading/Organizing the pieces and telling the client Game download progress, when finished and the location of each piece related


### Piece Downloading
It's the belief that Peer to Peer downloading is preferable over http or git but torrent isn't always available.

1. Check if a piece has already been downloaded (patch version changes can be ignored)
2. Download and validate the downloaded files are as expected
3. If patch version changes are available, notify the user
4. Support ways for user's to upload their pieces to popular services
  - git, torrent, http and ftp are available
  - [Supporting more protocols in the future is relatively simple](/plugins/download/protocol)

### Agreed Piece Selection
Before starting a match, player's need to pick their fighter(s) and stage that might be selected. This selection process needs to be handled somewhat delicately for the following reasons.

#### Player Selection Issues
1. A player who picks before another player opens themselves up to counter picking
2. Some picks will be shared between players and, while players have input, the final selection will be based on algorithm
  - Example: Both players pick a stage, but only one is chosen democratically or at random
  - All players use the same random seed based upon a collective input
3. Some selections have custom validations
  - Example: For tag team a player can have 3 "normal" characters or 1 "boss" character. The characters being a "boss" is configured in a seperate file with the default value being "normal"
4. A player can make a selection mandatory before any other players agree to join.
  - Example: If tag team or 1 v 1 are available, a player can make tag team mandatory before any other player joins.
5. Some Selections have multiple Steps (This will be ignored for now)
  - Example: Dota has a ban and select stage



## Using for a Game

This section is for playing a game that already has Roster Lock built in. If you're integrating Roster Lock into your own game instead, see [Implementing for a Game](#implementing-for-a-game) below.

Requires [Node.js](https://nodejs.org/) (npm) to be installed.

#### One-time Setup
1. `npm install -g @roster-lock/match-agent`
2. `rosterlock-match-agent install <authCode>` - `<authCode>` is required and is just a shared secret of your choosing, not something issued to you. Pick something unguessable; anyone who has it can access the pieces and match history on your machine.

#### Every time you want to play
1. `rosterlock-match-agent listen` - starts the match agent and leaves it running. It only needs to be started once per session and can serve multiple games/matches at a time, so you don't need to restart it between matches or games.
2. Start your game and, when prompted, give it the same `<authCode>` from setup.
   - Only enter your auth code into a game you trust - it grants full access to the match agent running on your machine.
3. Your game handles the rest.


## Implementing for a Game

Most of the heavy lifting is implemented in the [match agent](/core/match-agent) and the [relay server](/core/relay-server). However to use in a game a few pieces will be needed. View the [full local](examples/full-local) example for details.

#### Services Required
- Match Maker - Used to create the relay room
  - This is custom
  - Users join a match maker to start
  - When ready, the match maker creates a match in the relay server
    - [See Here](/examples/full-local/services/matchmaking/src/queue.ts#L213)
  - the match maker then tells each user the url and roomId to connect to
- Game Coordinator - Used to connect users for the game
  - This is custom
  - The relay room will notify the correct game coordinator if successful
  - Users join the game coordinator which can handle the game as you deem fit
- Relay Room - Used to share selections and download missing pieces
  - To spin up a relay room server, can just use cloudflare. If theres enough demand, a simple version using an http server can be made.
  - Before using the services, the Match maker and Game Coordinator must be regirstered on the relay room
- Download Provider - Used by players to download pieces
  - Support for [many](/plugins/download/protocol) has attempted to be implemented
  - You can use existing websites as the download providers. Its probably a good idea to ask for permission as people will be downloading pieces directly without seeing advertisements which will eat into costs.

#### Game Related Parts
- Client Required - [See the typescript example](/client/typescript)
- Proper flow from start to end - [see the headless game example](/examples/full-local/game/game-headless/src/steps/index.ts)
- Loading Assets - [See typescript example](/client/typescript/src/v1/file-routes.ts)
  - Instead of loading directly from the filesystem, assets are loaded through the match agent. This is done to support browser games that want to use match agent.


## Plugins

Originally, I wanted to simply package in a variety of download and untrusted script mechanisms, however I was running into packaging issues. Instead the roster lock works of plugins which are installed within a plugins folder and retrieved as needed. At the moment all the plugins are only what is made in the repo but I'd like to support user generated plugins in the future. If you want low hanging fruit, creating a plugin would be useful.

Theres 3 major categories for plugins
- [Download](/plugins/download) - Use to download pieces on demand
  - Compression - used to decompress downloaded archives (.gz, .br)
  - Archive - used to extract the files from an archive file (.zip, .rar, .tar)
  - Protocol - used to download a single or a full directory tree (torrent, http, ftp)
- [Untrusted Scripts](plugins/untrusted) - Used for running untrusted scripts
  - scripts - scripting language to use. Is expected to have a "gas" counter to prevent infinite loops
  - config - loads a configuration file as json for scripting languages. Some config files have scripting internally.
- [Sorted Indexes](/plugins/piece-selection-sort) - Used for sorting pieces for the user for easy access. For example, sort by win rate or by usage.


## Repository Structure

Roster Lock is a pnpm monorepo. The main pieces:

- `core/` - the engine itself
  - [match-agent](/core/match-agent) - the agent a player runs locally; downloads/organizes pieces and talks to the game client
  - [relay-server](/core/relay-server) - connects clients together for selection and piece sharing
  - [plugin-runtime](/core/plugin-runtime) - loads and runs download/untrusted-script plugins
  - [config-editor](/core/config-editor) - GUI (`gui`, `pwa`, `tauri`) and [CLI](/core/config-editor-cli) tools for building restriction configs
  - `shared`, `types`, `utils` - code shared across the other core packages
- [client/typescript](/client/typescript) - the TypeScript client used by games to talk to the match agent
- `plugins/` - installable [Download](/plugins/download) and [Untrusted Script](/plugins/untrusted) implementations, plus [piece-selection-sort](/plugins/piece-selection-sort) strategies
- [examples/full-local](/examples/full-local) - an end-to-end reference implementation (matchmaking, game coordinator, headless game) showing how the pieces fit together


## Developing Roster Lock

This section is for working on Roster Lock itself, not for using it in a game.

Requires [pnpm](https://pnpm.io/) `10.7.0` (see `packageManager` in [package.json](package.json)).

1. `pnpm install` - installs dependencies and builds packages
2. `pnpm test:core` - run the core package test suites
3. `pnpm test:example:full-local` - run the full-local integration example
4. `pnpm test:plugin:integration` - run download-protocol plugin integration tests
5. `pnpm generate-plugin-manifest` - regenerate [plugin-manifest.json](plugin-manifest.json) after adding or changing a plugin


## Roadmap

Roster Lock is still pre-1.0 and evolving. Known future directions:

- Skins/Mods Support
  - Allow a roster to specify optional media overrides
  - Allow the user to override media with local assets
- Match Agent Environments
  - Internet Cafe
    - Ensure everything works from a plugged in USB or Mobile Device
  - Arcade
    - Update (rosters/pre-downloaded pieces) multiple arcade machines at once
    - See Status of a machine
    - Load pieces from a plugged in USB or mobile device
      - Should ignore everything else on the USB
  - Local Network
    - Download peer to peer instead of through the internet
  - Mobile Device
- Relay Room
  - Relay over Direct TCP connection
  - A simple self-hosted HTTP relay room server, as an alternative to Cloudflare

> [plugins](/plugins) supporting more download protocols, archive and compression or untrusted scripts/configurations are happilly appreciated.

