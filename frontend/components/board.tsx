"use client";

import { DndContext, DragEndEvent, DragOverlay, PointerSensor, KeyboardSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { initialColumns } from "../lib/initial-data";
import type { Card, Column } from "../lib/types";
import { ColumnView } from "./column";
import { CardFormDialog, DeleteCardDialog, RenameColumnDialog } from "./board-dialogs";

export function reorderCards(cards: Card[], activeId: string, overId: string): Card[] {
  const oldIndex = cards.findIndex((card) => card.id === activeId);
  const newIndex = cards.findIndex((card) => card.id === overId);
  return oldIndex < 0 || newIndex < 0 ? cards : arrayMove(cards, oldIndex, newIndex);
}

type BoardProps = {
  columns?: Column[];
  boardName?: string;
  isVisible?: boolean;
  onLogout: () => void;
  onColumnsChange?: (columns: Column[], previousColumns: Column[]) => void;
};

export function Board({ columns: controlledColumns, boardName = "Q3 product launch", isVisible = true, onLogout, onColumnsChange }: BoardProps) {
  const [localColumns, setLocalColumns] = useState(initialColumns);
  const columns = controlledColumns ?? localColumns;
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [cardDialog, setCardDialog] = useState<{ columnId: string; card?: Card } | null>(null);
  const [renameColumn, setRenameColumn] = useState<Column | null>(null);
  const [deleteCard, setDeleteCard] = useState<Card | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function updateColumns(nextColumns: Column[], previousColumns: Column[]) {
    if (!controlledColumns) setLocalColumns(nextColumns);
    onColumnsChange?.(nextColumns, previousColumns);
  }

  function findCard(cardId: string) { for (const column of columns) { const card = column.cards.find((item) => item.id === cardId); if (card) return { card, columnId: column.id }; } return null; }
  function handleDragStart({ active }: { active: { id: string | number } }) { const result = findCard(String(active.id)); if (result) setActiveCard(result.card); }
  function handleDragCancel() { setActiveCard(null); }
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null);
    if (!over || active.id === over.id) return;
    const previousColumns = columns;
    const nextColumns = (() => {
      const sourceColumn = previousColumns.find((column) => column.cards.some((card) => card.id === active.id));
      const destinationColumn = previousColumns.find((column) => column.id === over.id) ?? previousColumns.find((column) => column.cards.some((card) => card.id === over.id));
      if (!sourceColumn || !destinationColumn) return previousColumns;
      if (sourceColumn.id === destinationColumn.id) {
        return previousColumns.map((column) => column.id === sourceColumn.id ? { ...column, cards: reorderCards(column.cards, String(active.id), String(over.id)) } : column);
      }
      const movedCard = sourceColumn.cards.find((card) => card.id === active.id);
      if (!movedCard) return previousColumns;
      const insertIndex = destinationColumn.cards.findIndex((card) => card.id === over.id);
      return previousColumns.map((column) => {
        if (column.id === sourceColumn.id) return { ...column, cards: column.cards.filter((card) => card.id !== active.id) };
        if (column.id === destinationColumn.id) {
          const cards = [...column.cards];
          cards.splice(insertIndex < 0 ? cards.length : insertIndex, 0, movedCard);
          return { ...column, cards };
        }
        return column;
      });
    })();
    if (nextColumns !== previousColumns) updateColumns(nextColumns, previousColumns);
  }
  function addCard(title: string, details: string) {
    if (!cardDialog) return;
    const card = { id: `card-${Date.now()}`, title, details };
    const nextColumns = columns.map((column) => column.id === cardDialog.columnId ? { ...column, cards: [...column.cards, card] } : column);
    updateColumns(nextColumns, columns);
    setCardDialog(null);
  }
  function updateCard(title: string, details: string) {
    if (!cardDialog?.card) return;
    const nextColumns = columns.map((column) => ({ ...column, cards: column.cards.map((card) => card.id === cardDialog.card?.id ? { ...card, title, details } : card) }));
    updateColumns(nextColumns, columns);
    setCardDialog(null);
  }
  function confirmDelete() {
    if (!deleteCard) return;
    const nextColumns = columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== deleteCard.id) }));
    updateColumns(nextColumns, columns);
    setDeleteCard(null);
  }
  function updateColumnName(name: string) {
    if (!renameColumn) return;
    const nextColumns = columns.map((column) => column.id === renameColumn.id ? { ...column, name } : column);
    updateColumns(nextColumns, columns);
    setRenameColumn(null);
  }

  return <main className="app-shell" hidden={!isVisible} aria-hidden={!isVisible}>
    <header className="topbar"><div className="brand-mark">Kanban board</div><div className="topbar-actions"><div className="topbar-meta"><span className="live-dot" /> Session only</div><button type="button" className="button button-quiet button-small" onClick={onLogout}>Log out</button></div></header>
    <section className="board-toolbar"><div><span className="section-label">Board</span><h1>{boardName}</h1></div><div className="toolbar-actions"><span className="card-total">{columns.reduce((total, column) => total + column.cards.length, 0)} cards</span><button type="button" className="button button-primary toolbar-add" onClick={() => setCardDialog({ columnId: columns[0].id })}><Plus size={17} /> Add card</button></div></section>
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}><div className="board-grid">{columns.map((column) => <ColumnView key={column.id} column={column} onAdd={(columnId) => setCardDialog({ columnId })} onRename={setRenameColumn} onEdit={(card) => { const location = findCard(card.id); if (location) setCardDialog({ columnId: location.columnId, card }); }} onDelete={setDeleteCard} />)}</div><DragOverlay>{activeCard ? <div className="task-card task-card-overlay"><ArrowUpRight size={16} /><h3>{activeCard.title}</h3></div> : null}</DragOverlay></DndContext>
    <footer className="board-footer"><span>Five steps, one shared direction.</span><span className="footer-key"><span className="key-dot" /> Changes live in this session only</span></footer>
    {cardDialog && <CardFormDialog card={cardDialog.card} onClose={() => setCardDialog(null)} onSubmit={cardDialog.card ? updateCard : addCard} />}
    {renameColumn && <RenameColumnDialog column={renameColumn} onClose={() => setRenameColumn(null)} onSubmit={updateColumnName} />}
    {deleteCard && <DeleteCardDialog card={deleteCard} onClose={() => setDeleteCard(null)} onConfirm={confirmDelete} />}
  </main>;
}
