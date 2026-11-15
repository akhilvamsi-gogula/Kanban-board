"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { initialColumns } from "../lib/initial-data";
import { addCard, countCards, deleteCard, findCard, moveCard, renameColumn, updateCard } from "../lib/board-ops";
import type { Card, Column } from "../lib/types";
import { ColumnView } from "./column";
import { ColumnNav } from "./column-nav";
import { AiAssistant } from "./ai-assistant";
import { CardFormDialog, DeleteCardDialog, RenameColumnDialog } from "./board-dialogs";
import { BoardSwitcher, type BoardSwitcherProps } from "./board-switcher";

export { reorderCards } from "../lib/board-ops";

type BoardProps = {
  columns?: Column[];
  boardName?: string;
  boardId?: string;
  ownerId?: string;
  username?: string;
  isVisible?: boolean;
  onLogout: () => void;
  onColumnsChange?: (columns: Column[], previousColumns: Column[]) => void;
  onBoardNameChange?: (nextBoardName: string) => void;
  switcher?: BoardSwitcherProps;
};

export function Board({
  columns: controlledColumns,
  boardName = "My board",
  boardId = "demo-board",
  ownerId = "demo-user",
  username,
  isVisible = true,
  onLogout,
  onColumnsChange,
  onBoardNameChange,
  switcher,
}: BoardProps) {
  const [localColumns, setLocalColumns] = useState(initialColumns);
  const columns = controlledColumns ?? localColumns;
  const [activeCard, setActiveCard] = useState<{ card: Card; width?: number } | null>(null);
  const [cardDialog, setCardDialog] = useState<{ columnId: string; card?: Card } | null>(null);
  const [columnToRename, setColumnToRename] = useState<Column | null>(null);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  // Separate mouse and touch sensors (dnd-kit's recommended setup for mixed input): a touch drag
  // starts after a short press on the handle, so a quick swipe elsewhere still scrolls the board.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateColumns(nextColumns: Column[]) {
    if (nextColumns === columns) return;
    if (!controlledColumns) setLocalColumns(nextColumns);
    onColumnsChange?.(nextColumns, columns);
  }

  function applyBoard(nextColumns: Column[], nextBoardName: string) {
    onBoardNameChange?.(nextBoardName);
    updateColumns(nextColumns);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const result = findCard(columns, String(active.id));
    if (result) setActiveCard({ card: result.card, width: active.rect.current.initial?.width });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null);
    if (over) updateColumns(moveCard(columns, String(active.id), String(over.id)));
  }

  function editCard(card: Card) {
    const location = findCard(columns, card.id);
    if (location) setCardDialog({ columnId: location.columnId, card });
  }

  function submitCard(title: string, details: string) {
    if (!cardDialog) return;
    updateColumns(cardDialog.card
      ? updateCard(columns, cardDialog.card.id, title, details)
      : addCard(columns, cardDialog.columnId, title, details));
    setCardDialog(null);
  }

  function confirmDelete() {
    if (!cardToDelete) return;
    updateColumns(deleteCard(columns, cardToDelete.id));
    setCardToDelete(null);
  }

  function submitColumnName(name: string) {
    if (!columnToRename) return;
    updateColumns(renameColumn(columns, columnToRename.id, name));
    setColumnToRename(null);
  }

  const cardCount = countCards(columns);

  return (
    <main className="app-shell" hidden={!isVisible} aria-hidden={!isVisible}>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark">Kanban board</div>
          {switcher && <BoardSwitcher {...switcher} />}
        </div>
        <div className="topbar-actions">
          <div className="topbar-meta">
            <span className="live-dot" /> {username ? `Signed in as ${username}` : "Signed in"}
          </div>
          <button type="button" className="button button-quiet button-small" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <section className="board-toolbar">
        <div>
          <span className="section-label">Board</span>
          <h1>{boardName}</h1>
        </div>
        <div className="toolbar-actions">
          <span className="card-total">{cardCount} {cardCount === 1 ? "card" : "cards"}</span>
          <button type="button" className="button button-primary toolbar-add" onClick={() => setCardDialog({ columnId: columns[0].id })}>
            <Plus size={17} /> Add card
          </button>
          <button
            type="button"
            className="ai-launcher"
            onClick={() => setIsAssistantOpen(true)}
            aria-label="AI assistant"
            aria-expanded={isAssistantOpen}
          >
            <span className="ai-launcher-icon"><Sparkles size={18} /></span>
            <span><strong>AI co-pilot</strong><small>Ask or change your board</small></span>
            <ArrowUpRight size={17} />
          </button>
        </div>
      </section>

      <ColumnNav columns={columns} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveCard(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="board-grid">
          {columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              onAdd={(columnId) => setCardDialog({ columnId })}
              onRename={setColumnToRename}
              onEdit={editCard}
              onDelete={setCardToDelete}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="task-card task-card-overlay" style={{ width: activeCard.width }}>
              <ArrowUpRight size={16} />
              <h3>{activeCard.card.title}</h3>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AiAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        boardId={boardId}
        ownerId={ownerId}
        boardName={boardName}
        columns={columns}
        onApplyBoard={applyBoard}
      />

      <footer className="board-footer">
        <span>Five steps, one shared direction.</span>
        <span className="footer-key"><span className="key-dot" /> Changes save automatically to your account</span>
      </footer>

      {cardDialog && <CardFormDialog card={cardDialog.card} onClose={() => setCardDialog(null)} onSubmit={submitCard} />}
      {columnToRename && <RenameColumnDialog column={columnToRename} onClose={() => setColumnToRename(null)} onSubmit={submitColumnName} />}
      {cardToDelete && <DeleteCardDialog card={cardToDelete} onClose={() => setCardToDelete(null)} onConfirm={confirmDelete} />}
    </main>
  );
}
