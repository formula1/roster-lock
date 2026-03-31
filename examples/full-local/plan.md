# Test Plan

## Game Setup
- Create Game
  - Has multiple piece types
    - At least one of each selection strategy
      - mandatory
      - personal
      - shared
      - on demand
  - Can get loaded into the game
    - examples/full-local/game-headless/src/steps/3-game/assets.ts
  - Gets used in the actual game
    - examples/full-local/game-headless/src/steps/3-game/play.ts
- Create a matchlock config for the game
  - core/shared/src/match-lock-file/match-config/version-1/index.ts
    - RosterLockV1Schema
- Create usable game pieces
- Make usable game pieces accessible from the Download Service


## Service Setup
- Start All Services
  - Download Service - Used to download pieces
  - Matchmaking Service - Users can join and be matched with another user
  - Relay Room Service - Used to relay match lock messages between users
  - Game Service - Used for the actual game
- Add the matchmaking service to the relay room
  - create public key
  - add public key to the relay room
- Add the game service to the relay room
  - create api key
  - add api key to the relay room

## Game Start
- Run two instances of the game headless (Needs two or else the matchmaking wont start)
  - examples/full-local/game-headless/src/steps/index.ts


# Services
- Download Service
  - file location - examples/full-local/services/download
- Matchmaking Service
  - file location - examples/full-local/services/matchmaking
- Relay Room Service
  - file location - core/relay-server 
- Game Service
  - file location - examples/full-local/services/game-server



# Game

> Each Piece type is defined as the following
> - GamePiece - Piece Type - Number of Pieces
> In addition we specify a few files that are expected in each piece folder and their type
> - File Type - File Description
> I also may provide some examples for the pieces

- hud - mandatory - 1 - We only need one hud for now
  - media
    - I'd like to make the hud a react component that sits on top of the game
    - we feed it game state as props
- stage - shared - 3 - beach (sun), mountain (snow), rain forest (rain)
  - media - has a background image
  - logic - has initial weather effect, how many turns
  - requires - weather
- character - personal - 3
  - media - back image
  - media - front image
  - logic - stats - hp, attack, speed
  - requires - moves (Full selectable)
  - Examples
    - Yellow - { hp: 3, attack: 2, speed: 1 }
    - Red - { hp: 1, attack: 3, speed: 2 }
    - Blue - { hp: 2, attack: 1, speed: 3 }
- moves - on demand - 8
  - no weather, random weather, weak damage, strong damage
  - media - animation
  - logic - damage, does it cause weather, how many turns
  - requires - weather
  - Examples
    - Weak - { damage: 1 }
    - Basic - { damage: 3 }
    - Strong - { damage: 6 }
    - RandomWeather - { damage: 1, weather: ()=>{ type: WEATHER, turns: number } } // Runs a getter
    - Sun - { damage: 1, weather: { type: "sun", turns: 3 } }
    - Rain - { damage: 1, weather: { type: "rain", turns: 3 } }
    - Snow - { damage: 1, weather: { type: "snow", turns: 3 } }
    - Remove Weather - { damage: 1, weather: { type: "none", turns: -1 } }
- weather - on demand - 4 - none, sun, rain, snow
  - media - particle effect
  - We don't need to add logic for this, just proof of concept