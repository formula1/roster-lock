import { useEffect, useState } from "react";
import { PiecePreview, RosterLockPiece } from "@roster-lock/types";
import { getGameLauncherPreview, PiecePreviewResult } from "../api/matchAgent";
import { useSelectionSource } from "../context/SelectionSourceContext";

// What a caller sees. "idle" is a disabled/unasked hook (nothing hovered, a
// card still below the fold) and is deliberately distinct from a resolved
// "ready" with a null preview, which means match-agent answered and this
// piece genuinely has none - only the latter should make a UI commit to its
// fallback.
export type PiecePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | ({ status: "ready" } & PiecePreviewResult);

const IDLE: PiecePreviewState = { status: "idle" };
const LOADING: PiecePreviewState = { status: "loading" };
const NO_PREVIEW: PiecePreviewResult = { preview: null, source: null };

// Module-level (not per-component) so repeated hovers of the same piece
// across renders/remounts don't refetch, and concurrent hovers of the same
// piece dedupe onto one in-flight request. A resolved null preview (piece not
// downloaded and the plugin has no useDefaultPreview, unsupported sprite
// format, no getPreview at all, ...) is cached too - same shape as a real
// preview, just empty - so a piece that can't produce one doesn't get
// re-queried on every hover.
const previewCache = new Map<string, Promise<PiecePreviewResult>>();

// Every on-screen card asks for its own thumbnail, and on the match-agent
// side each answer means reading and decoding a sprite out of that piece's
// own assets. A few hundred of those fired at once would bury the same agent
// the rest of the selection screen is talking to, so cards queue behind this
// limit. The hover/focus panel asks with priority: it's answering a question
// the player just asked, and shouldn't sit behind a screenful of thumbnails.
const MAX_IN_FLIGHT = 4;
type QueueEntry = { key: string, start: () => void };
const waiting: Array<QueueEntry> = [];
let inFlight = 0;

function pump(): void {
  while (inFlight < MAX_IN_FLIGHT && waiting.length > 0) waiting.shift()!.start();
}

function promote(key: string): void {
  const index = waiting.findIndex((entry) => entry.key === key);
  if (index > 0) waiting.unshift(waiting.splice(index, 1)[0]);
}

function requestPreview(
  key: string, priority: boolean, run: () => Promise<PiecePreviewResult>
): Promise<PiecePreviewResult> {
  const cached = previewCache.get(key);
  if (cached) {
    // Already queued at the back by some card - a hover on that same piece
    // should still jump it forward rather than start a second request.
    if (priority) promote(key);
    return cached;
  }
  const promise = new Promise<PiecePreviewResult>((resolve) => {
    const entry: QueueEntry = {
      key,
      start: () => {
        inFlight += 1;
        run().catch(() => NO_PREVIEW).then((result) => {
          inFlight -= 1;
          resolve(result);
          pump();
        });
      },
    };
    if (priority) waiting.unshift(entry);
    else waiting.push(entry);
    pump();
  });
  previewCache.set(key, promise);
  return promise;
}

function cacheKey(pluginName: string, pieceType: string, piece: Pick<RosterLockPiece, "version">): string {
  return `${pluginName}\x00${pieceType}\x00${piece.version.logic}\x00${piece.version.media}`;
}

// `piece` is null when nothing is currently hovered/cursored, and `enabled`
// is false for a card that hasn't scrolled into view or isn't downloaded yet
// - both report "idle" without making any request.
export function usePiecePreview(args: {
  pieceType: string,
  piece: Pick<RosterLockPiece, "version" | "pathVariables"> | null,
  enabled?: boolean,
  priority?: boolean,
}): PiecePreviewState {
  const { pieceType, piece, enabled = true, priority = false } = args;
  const { pluginName, engine, matchAgentUrl, matchAgentAuth } = useSelectionSource();
  const [state, setState] = useState<PiecePreviewState>(IDLE);

  useEffect(() => {
    if (!piece || !enabled) {
      setState(IDLE);
      return;
    }
    const key = cacheKey(pluginName, pieceType, piece);
    const pending = requestPreview(key, priority, () => getGameLauncherPreview(
      matchAgentUrl, matchAgentAuth, pluginName, engine, pieceType, piece
    ));

    let cancelled = false;
    setState(LOADING);
    pending.then((result) => {
      if (!cancelled) setState({ status: "ready", ...result });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName, pieceType, enabled, priority, piece?.version.logic, piece?.version.media]);

  return state;
}

// The one image a UI should actually show for a preview, or undefined if
// there isn't one. PiecePreview also has a "model" kind for a future 3D
// engine plugin; until something renders those, an <img> caller treats one
// the same as no preview at all rather than pointing src at a model URI.
export function previewImage(preview: PiecePreview | null | undefined): string | undefined {
  return preview?.kind === "image" ? preview.dataUri : undefined;
}
