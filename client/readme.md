# Match Agent Clients

> Simple libraries that can talk to the match-agent over IPC.

# HTTP

# Plan
- Find or Create a Nodejs Library that can talk to the match-agent over IPC
- Make sure can feed JSON messages and can recieve events that can be parsed

## Process
- Send - Relay Room Connection
  - Provide
    - Relay URL
    - Room Id
    - User's Private Key
    - User's Game Selection
- Events
  - Failure Event - Should Exit Room on Failure
  - All Selection Shared
  - Users Download Progress
  - Full Finish
    - Provides all User Selections
    - Provides the folder locations of each Selected Piece

## Types
```typescript

type RoomConfiguration = {
  relayUrl: string,
  roomId: string,
  userId: string
}

type UserId = string;
type PieceType = string;
type PieceId = string;

type PersonalSelectons = Record<PieceType, Array<PieceId>>

type FinalSelections = Record<PieceType, (
  | Record<UserId, Array<PieceId>>
  | Array<PieceId>
  // sometimes an algorithm returns a single list
  // example: democracy
)>

type DownloadProgress = number
type DownloadLocation = string;

type PieceLocations = Record<PieceType, Record<PieceId, DownloadLocation>>

type resolveMatchFn = (
  input: { room: RoomConfiguration, selections: PersonalSelectons, signal?: AbortSignal }
)=>{
  onSelectionReady: ISimpleEventEmitter<[FinalSelections]>,
  onDownloadProgress: ISimpleEventEmitter<
    [UserId, PieceType, PieceId, DownloadProgress]
  >,
  finishPromise: Promise<{
    selections: FinalSelections,
    selectionLocations: PieceLocations
  }>
}
```

## Usage

```typescript
const abortController = new AbortController();
try {
  const { onSelectionReady, onDownloadProgress, finishPromise } = resolveMatchFn({
    room, selections, signal: abortController.signal
  });

  onSelectionReady(updateSelectionUI)
  onDownloadProgress(updateDownloadUI)

  const { selections, selectionLocations } = await finishPromise;
  loadSelectionsIntoGame(selections, selectionLocations)
  await syncronizeClock()
  startMatch()
}catch(e){
  console.log("Match To Start Failed", e);
  goToLobby()
}
```
