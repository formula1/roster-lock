# TODO

The first target planned for match lock is a Go project.
Planned is a simple library that can talk to the match-agent over IPC.

# Plan
- Find or Create a Go Library that can talk to the match-agent over IPC
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
```go

package rosterlock

import (
    "context"
    "errors"
)

type RoomConfiguration struct {
    RelayURL string
    RoomID   string
    UserID   string
}

type UserID = string
type PieceType = string
type PieceID = string

type PersonalSelections map[PieceType][]PieceID
type FinalSelections map[PieceType]interface{}
type PieceLocations map[PieceType]map[PieceID]string

type DownloadProgressEvent struct {
    UserID    UserID
    PieceType PieceType
    PieceID   PieceID
    Progress  float64
}

type MatchResult struct {
    Selections         FinalSelections
    SelectionLocations PieceLocations
    Err                error
}

type MatchResolver struct {
    SelectionReady   <-chan FinalSelections
    DownloadProgress <-chan DownloadProgressEvent
    Result           <-chan MatchResult
    
    ctx    context.Context
    cancel context.CancelFunc
}

func ResolveMatch(ctx context.Context, room RoomConfiguration, selections PersonalSelections) *MatchResolver {
    if ctx == nil {
        ctx = context.Background()
    }
    ctx, cancel := context.WithCancel(ctx)
    
    selectionCh := make(chan FinalSelections, 1)
    progressCh := make(chan DownloadProgressEvent, 100)
    resultCh := make(chan MatchResult, 1)
    
    resolver := &MatchResolver{
        SelectionReady:   selectionCh,
        DownloadProgress: progressCh,
        Result:           resultCh,
        ctx:              ctx,
        cancel:           cancel,
    }
    
    go resolver.resolve(room, selections, selectionCh, progressCh, resultCh)
    
    return resolver
}

func (r *MatchResolver) Cancel(reason string) error {
    r.cancel()
    return errors.New(reason)
}

func (r *MatchResolver) resolve(
    room RoomConfiguration,
    selections PersonalSelections,
    selectionCh chan<- FinalSelections,
    progressCh chan<- DownloadProgressEvent,
    resultCh chan<- MatchResult,
) {
    defer close(selectionCh)
    defer close(progressCh)
    defer close(resultCh)
    
    // Your implementation here
    
    // Example usage:
    // When selections ready:
    // select {
    // case selectionCh <- finalSelections:
    // case <-r.ctx.Done():
    //     resultCh <- MatchResult{Err: r.ctx.Err()}
    //     return
    // }
    
    // When download progress:
    // select {
    // case progressCh <- DownloadProgressEvent{...}:
    // case <-r.ctx.Done():
    //     resultCh <- MatchResult{Err: r.ctx.Err()}
    //     return
    // }
    
    // When complete:
    // resultCh <- MatchResult{Selections: ..., SelectionLocations: ...}
}
```

## Usage
```go
// Create resolver
resolver := ResolveMatch(context.Background(), room, selections)

// Listen to events
go func() {
    for selections := range resolver.SelectionReady {
        updateSelectionUI(selections)
    }
}()

go func() {
    for progress := range resolver.DownloadProgress {
        updateDownloadUI(progress.UserID, progress.PieceType, progress.PieceID, progress.Progress)
    }
}()

// Wait for result
result := <-resolver.Result
if result.Err != nil {
    return fmt.Errorf("failed to resolve match: %w", result.Err)
}

loadSelectionsIntoGame(result.Selections, result.SelectionLocations)
synchronizeClock()
startMatch()

```