"use client";

import { DndContext, DragEndEvent, DragOverlay, PointerSensor, KeyboardSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FormEvent, useState } from "react";
import { ArrowUpRight, Bot, Plus, Send, Sparkles, X } from "lucide-react";
import { initialColumns } from "../lib/initial-data";
import { askBoardAssistant, type AiBoardUpdate, type AiMessage } from "../lib/api";
import type { Card, Column } from "../lib/types";
import { ColumnView } from "./column";
import { CardFormDialog, DeleteCardDialog, RenameColumnDialog } from "./board-dialogs";

export function reorderCards(cards: Card[], activeId: string, overId: string): Card[] {
  const oldIndex = cards.findIndex((card) => card.id === activeId);
  const newIndex = cards.findIndex((card) => card.id === overId);
  return oldIndex < 0 || newIndex < 0 ? cards : arrayMove(cards, oldIndex, newIndex);
}

const UNDO_REQUEST_PATTERN = /\bundo\b/i;

type BoardProps = {
  columns?: Column[];
  boardName?: string;
  username?: string;
  isVisible?: boolean;
  onLogout: () => void;
  onColumnsChange?: (columns: Column[], previousColumns: Column[]) => void;
  onBoardNameChange?: (nextBoardName: string) => void;
};

export function Board({ columns: controlledColumns, boardName = "My board", username, isVisible = true, onLogout, onColumnsChange, onBoardNameChange }: BoardProps) {
  const [localColumns, setLocalColumns] = useState(initialColumns);
  const columns = controlledColumns ?? localColumns;
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [cardDialog, setCardDialog] = useState<{ columnId: string; card?: Card } | null>(null);
  const [renameColumn, setRenameColumn] = useState<Column | null>(null);
  const [deleteCard, setDeleteCard] = useState<Card | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "Ask me to rename a column, add a task, or update the board." },
  ]);
  const [preAiUpdateState, setPreAiUpdateState] = useState<{ columns: Column[]; boardName: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function updateColumns(nextColumns: Column[], previousColumns: Column[]) {
    if (!controlledColumns) setLocalColumns(nextColumns);
    onColumnsChange?.(nextColumns, previousColumns);
  }

  function applyAiBoardUpdate(boardUpdate: AiBoardUpdate) {
    const nextColumns = boardUpdate.columns.map((column, index) => ({
      id: column.id,
      name: column.name,
      accent: column.accent,
      cards: column.cards
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((card) => ({
          id: card.id,
          title: card.title,
          details: card.details,
        })),
      position: index,
    })) as Column[];

    onBoardNameChange?.(boardUpdate.name);
    updateColumns(nextColumns, columns);
  }

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = assistantDraft.trim();
    if (!trimmedPrompt || isAssistantLoading) return;

    const userMessage: AiMessage = { role: "user", content: trimmedPrompt };
    setAssistantMessages((current) => [...current, userMessage]);
    setAssistantDraft("");
    setAssistantError(null);

    // The AI is never shown prior board states, only the current one plus text history, so it
    // cannot reconstruct an earlier layout — "undo" is handled locally from a real snapshot instead.
    if (UNDO_REQUEST_PATTERN.test(trimmedPrompt)) {
      if (preAiUpdateState) {
        onBoardNameChange?.(preAiUpdateState.boardName);
        updateColumns(preAiUpdateState.columns, columns);
        setPreAiUpdateState(null);
        setAssistantMessages((current) => [...current, { role: "assistant", content: "Reverted the last board update I made." }]);
      } else {
        setAssistantMessages((current) => [...current, { role: "assistant", content: "There's nothing from me to undo yet." }]);
      }
      return;
    }

    setIsAssistantLoading(true);

    try {
      const response = await askBoardAssistant(trimmedPrompt, {
        id: "demo-user-board",
        owner_id: "demo-user",
        name: boardName,
        columns: columns.map((column, columnIndex) => ({
          ...column,
          position: columnIndex,
          cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
        })),
      }, assistantMessages.slice(-8));

      setAssistantMessages((current) => [...current, { role: "assistant", content: response.assistant_message }]);
      if (response.board_update) {
        setPreAiUpdateState({ columns, boardName });
        applyAiBoardUpdate(response.board_update);
      }
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "The assistant could not answer right now.");
      setAssistantMessages((current) => [...current, { role: "assistant", content: "I hit a problem trying to update the board. Please try again." }]);
    } finally {
      setIsAssistantLoading(false);
    }
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
    <header className="topbar"><div className="brand-mark">Kanban board</div><div className="topbar-actions"><div className="topbar-meta"><span className="live-dot" /> {username ? `Signed in as ${username}` : "Signed in"}</div><button type="button" className="button button-quiet button-small" onClick={onLogout}>Log out</button></div></header>
    <section className="board-toolbar"><div><span className="section-label">Board</span><h1>{boardName}</h1></div><div className="toolbar-actions"><span className="card-total">{columns.reduce((total, column) => total + column.cards.length, 0)} cards</span><button type="button" className="button button-primary toolbar-add" onClick={() => setCardDialog({ columnId: columns[0].id })}><Plus size={17} /> Add card</button><button type="button" className="ai-launcher" onClick={() => setIsAssistantOpen(true)} aria-label="AI assistant" aria-expanded={isAssistantOpen}><span className="ai-launcher-icon"><Sparkles size={18} /></span><span><strong>AI co-pilot</strong><small>Ask or change your board</small></span><ArrowUpRight size={17} /></button></div></section>
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}><div className="board-grid">{columns.map((column) => <ColumnView key={column.id} column={column} onAdd={(columnId) => setCardDialog({ columnId })} onRename={setRenameColumn} onEdit={(card) => { const location = findCard(card.id); if (location) setCardDialog({ columnId: location.columnId, card }); }} onDelete={setDeleteCard} />)}</div><DragOverlay>{activeCard ? <div className="task-card task-card-overlay"><ArrowUpRight size={16} /><h3>{activeCard.title}</h3></div> : null}</DragOverlay></DndContext>
    {isAssistantOpen && <>
      <button type="button" className="ai-backdrop" aria-label="Close AI assistant" onClick={() => setIsAssistantOpen(false)} />
      <aside className="ai-panel" aria-label="AI assistant panel">
      <div className="ai-header"><div className="ai-title"><span className="ai-title-icon"><Bot size={19} /></span><div><span className="section-label">AI co-pilot</span><h2>AI assistant</h2></div></div><button type="button" className="icon-button" aria-label="Close AI assistant" onClick={() => setIsAssistantOpen(false)}><X size={17} /></button></div>
      <p className="ai-intro">Your board is in context. Ask a question or describe a change and I will help you make it happen.</p>
      <div className="ai-messages" role="log" aria-live="polite">
        {assistantMessages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`ai-message ai-message-${message.role}`}>
            <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      {assistantError && <p className="ai-error">{assistantError}</p>}
      <form className="ai-composer" onSubmit={handleAssistantSubmit}>
        <label htmlFor="assistant-prompt" className="sr-only">Ask the board assistant</label>
        <textarea id="assistant-prompt" value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} rows={4} placeholder="Ask the board assistant to rename a column, add a task, or reorder cards" aria-label="Ask the board assistant" disabled={isAssistantLoading} />
        <div className="ai-actions"><button type="button" className="button button-quiet button-small" onClick={() => setAssistantDraft("")} disabled={isAssistantLoading}>Clear</button><button type="submit" className="button button-primary button-small" disabled={isAssistantLoading}>{isAssistantLoading ? "Thinking..." : <><Send size={14} /> Send</>}</button></div>
      </form>
      </aside>
    </>}
    <footer className="board-footer"><span>Five steps, one shared direction.</span><span className="footer-key"><span className="key-dot" /> Changes live in this session only</span></footer>
    {cardDialog && <CardFormDialog card={cardDialog.card} onClose={() => setCardDialog(null)} onSubmit={cardDialog.card ? updateCard : addCard} />}
    {renameColumn && <RenameColumnDialog column={renameColumn} onClose={() => setRenameColumn(null)} onSubmit={updateColumnName} />}
    {deleteCard && <DeleteCardDialog card={deleteCard} onClose={() => setDeleteCard(null)} onConfirm={confirmDelete} />}
  </main>;
}
