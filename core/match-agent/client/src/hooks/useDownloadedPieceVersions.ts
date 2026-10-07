import { useEffect, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { listDownloadedPiecesFromConfig } from "@roster-lock/ts-client";
import { useSelectionSource } from "../context/SelectionSourceContext";

const PAGE_SIZE = 200;

// Which of a piece type's roster entries match-agent already has on disk, as
// a set of logic hashes. null until the first answer arrives - that's what
// lets a card show no download status at all on mount rather than flashing
// "Not downloaded" at every piece before the list comes back.
export function useDownloadedPieceVersions(
  rosterConfig: RosterLockV1Config, pieceType: string
): ReadonlySet<string> | null {
  const { matchAgentUrl, matchAgentAuth } = useSelectionSource();
  const [downloaded, setDownloaded] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDownloaded(null);
    // Paged rather than one large limit: a big roster can hold more entries
    // than any single page returns, and a silently truncated answer reads as
    // "the rest of the roster isn't downloaded".
    (async () => {
      const logic = new Set<string>();
      for (let page = 0; !cancelled; page += 1) {
        const rows = await listDownloadedPiecesFromConfig(
          { version: 1, rosterConfig, pieceType }, { page, limit: PAGE_SIZE }, matchAgentAuth, matchAgentUrl
        );
        for (const row of rows) logic.add(row.version.logic);
        if (rows.length < PAGE_SIZE) break;
      }
      if (!cancelled) setDownloaded(logic);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [rosterConfig, pieceType, matchAgentUrl, matchAgentAuth]);

  return downloaded;
}
