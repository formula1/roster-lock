import { useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { usePlugins, type AgentPieceItem } from "../../../../../globals/agent";
import { usePromisedMemo } from "../../../../../utils/react";
import { PieceValue, PieceDraftInfo } from "../types";
import { PieceDefinitionInput } from "../AddPieceFromFolder/PieceDefinitionInput";

const PAGE_SIZE = 10;

// Pieces the connected match-agent downloaded during matches - already on
// disk and version-validated, so adding one to the roster costs nothing.
export function AddPieceFromAgent(
  { onSubmit, rosterLock }: {
    onSubmit: (v: {
      pieceDefinitionKey: string
      piece: PieceValue,
      draftInfo: PieceDraftInfo,
    })=>unknown,
    rosterLock: RosterLockV1Config
  }
){
  const plugins = usePlugins();
  const [pieceDefinitionKey, setPieceDefinitionKey] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const listing = usePromisedMemo(async ()=>{
    if(!plugins || !pieceDefinitionKey) return null;
    return plugins.searchPieces({
      engineName: rosterLock.engine.name,
      pieceType: pieceDefinitionKey,
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    });
  }, [plugins, rosterLock.engine.name, pieceDefinitionKey, search, page]);

  if(Object.values(rosterLock.engine.pieceDefinitions).length === 0) return null;

  return (
    <div className="section">
      <h3>Add Piece From Match Agent</h3>
      {!plugins ? (
        <div>Connect a match-agent to browse the pieces it has downloaded.</div>
      ) : (
        <>
          <PieceDefinitionInput
            radioGroup="agent-piece-definition-key"
            value={pieceDefinitionKey}
            onChange={(v)=>{ setPieceDefinitionKey(v); setPage(0); }}
            rosterLock={rosterLock}
          />
          <div>
            <input
              type="text"
              placeholder="Search name, author, source..."
              value={searchInput}
              onChange={(e)=>setSearchInput(e.target.value)}
            />
            <button onClick={()=>{ setSearch(searchInput); setPage(0); }}>Search</button>
          </div>
          {listing.status === "pending" && <div>Loading...</div>}
          {listing.status === "failed" && (
            <div className="error">{errorToString(listing.error)}</div>
          )}
          {listing.status === "success" && listing.value && (
            listing.value.items.length === 0 ? (
              <div>No downloaded pieces {search ? "match the search" : "yet"} for this piece type</div>
            ) : (
              <>
                {listing.value.items.map((item)=>(
                  <AgentPieceRow
                    key={`${item.piece.version.logic}/${item.piece.version.media}`}
                    item={item}
                    alreadyInRoster={
                      !!rosterLock.rosters[pieceDefinitionKey]?.some((piece)=>(
                        piece.version.logic === item.piece.version.logic
                        && piece.version.media === item.piece.version.media
                      ))
                    }
                    onAdd={()=>onSubmit({
                      pieceDefinitionKey,
                      piece: {
                        // The agent stores pieces by hash - the id and any
                        // required pieces are the roster author's to assign.
                        id: item.piece.humanInfo.name
                          || `#${item.piece.version.logic}/${item.piece.version.media}`,
                        version: item.piece.version,
                        humanInfo: item.piece.humanInfo,
                        downloadSources: item.piece.downloadSources.map((s)=>s.source),
                        pathVariables: item.piece.pathVariables,
                        requiredPieces: {},
                      },
                      draftInfo: {
                        // Sources the agent already downloaded and
                        // version-validated count as passed source tests.
                        testedDownloadSources: item.piece.downloadSources
                          .filter((s)=>s.success && s.lastTest !== null)
                          .map((s)=>({
                            source: s.source,
                            testedAt: s.lastTest as number,
                            version: item.piece.version,
                          })),
                      },
                    })}
                  />
                ))}
                <Pagination
                  page={page}
                  total={listing.value.total}
                  onChange={setPage}
                />
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

function AgentPieceRow(
  { item, alreadyInRoster, onAdd }: {
    item: AgentPieceItem,
    alreadyInRoster: boolean,
    onAdd: ()=>unknown,
  }
){
  const { piece } = item;
  const lastGoodSource = piece.downloadSources
    .filter((s)=>s.success)
    .sort((a, b)=>(b.lastTest ?? 0) - (a.lastTest ?? 0))[0];
  return (
    <div style={{ padding: "5px", border: "solid 1px #000", borderRadius: "5px", marginBottom: "5px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          disabled={alreadyInRoster}
          title={alreadyInRoster ? "Already in this roster" : undefined}
          onClick={onAdd}
        >{alreadyInRoster ? "Added" : "Add"}</button>
        <span>
          {piece.humanInfo.name
            ? `${piece.humanInfo.name} (${piece.humanInfo.author || "unknown author"})`
            : `#${piece.version.logic}`}
        </span>
      </div>
      <div>Logic: {piece.version.logic}</div>
      {lastGoodSource && <div>Source: {lastGoodSource.source}</div>}
      {item.completedAt && <div>Downloaded: {new Date(item.completedAt).toLocaleString()}</div>}
    </div>
  );
}

function Pagination(
  { page, total, onChange }: {
    page: number,
    total: number,
    onChange: (page: number)=>void,
  }
){
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <button disabled={page <= 0} onClick={()=>onChange(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pageCount} ({total} pieces)</span>
      <button disabled={page >= pageCount - 1} onClick={()=>onChange(page + 1)}>Next</button>
    </div>
  );
}

function errorToString(error: unknown){
  return error instanceof Error ? error.message : String(error);
}
