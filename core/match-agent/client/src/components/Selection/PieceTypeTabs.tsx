// Piece-type tabs are shared across every player slot - switching a tab
// swaps which piece type's grid is mounted for all slots at once, rather
// than each slot owning its own tab state. The dot reflects whether every
// slot's picks for that piece type currently satisfy its min/max, so
// players can see at a glance which tabs still need attention before
// Confirm unlocks (see SelectionBoard.allValid).
export function PieceTypeTabs({ types, activeType, readyByType, onSelect }: {
  types: Array<string>,
  activeType: string,
  readyByType: Record<string, boolean>,
  onSelect: (pieceType: string) => void,
}) {
  if (types.length === 0) return null;

  return (
    <nav className="piece-type-tabs">
      {types.map((pieceType) => (
        <button
          key={pieceType}
          type="button"
          className="piece-type-tab"
          data-active={pieceType === activeType}
          onClick={() => onSelect(pieceType)}
        >
          <span className="piece-type-tab-dot" data-ready={readyByType[pieceType] ?? false} aria-hidden="true" />
          {pieceType}
        </button>
      ))}
    </nav>
  );
}
