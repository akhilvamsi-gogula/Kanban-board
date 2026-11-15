import type { Column } from "../lib/types";

// On a phone only about one column fits on screen; these chips (hidden on wider screens via CSS)
// show every column and scroll the board sideways to the one tapped.
export function ColumnNav({ columns }: { columns: Column[] }) {
  function jumpTo(columnId: string) {
    document.getElementById(`column-${columnId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  return (
    <nav className="column-nav" aria-label="Jump to column">
      {columns.map((column) => (
        <button key={column.id} type="button" className="column-nav-chip" onClick={() => jumpTo(column.id)}>
          <span className="column-dot" style={{ backgroundColor: column.accent }} aria-hidden="true" />
          {column.name}
          <span className="column-nav-count">{column.cards.length}</span>
        </button>
      ))}
    </nav>
  );
}
