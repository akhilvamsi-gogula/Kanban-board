import { arrayMove } from "@dnd-kit/sortable";
import type { Card, Column } from "./types";

// Pure board operations. Each returns a new columns array (or the same array when nothing
// changed), so callers can hand the result straight to the optimistic save.

export function reorderCards(cards: Card[], activeId: string, overId: string): Card[] {
  const oldIndex = cards.findIndex((card) => card.id === activeId);
  const newIndex = cards.findIndex((card) => card.id === overId);
  return oldIndex < 0 || newIndex < 0 ? cards : arrayMove(cards, oldIndex, newIndex);
}

export function findCard(columns: Column[], cardId: string): { card: Card; columnId: string } | null {
  for (const column of columns) {
    const card = column.cards.find((item) => item.id === cardId);
    if (card) return { card, columnId: column.id };
  }
  return null;
}

// Drop `activeId` onto `overId`, which is either a card (take its place) or a column (append).
export function moveCard(columns: Column[], activeId: string, overId: string): Column[] {
  if (activeId === overId) return columns;
  const source = columns.find((column) => column.cards.some((card) => card.id === activeId));
  const destination = columns.find((column) => column.id === overId) ?? columns.find((column) => column.cards.some((card) => card.id === overId));
  if (!source || !destination) return columns;
  if (source.id === destination.id) {
    const cards = reorderCards(source.cards, activeId, overId);
    return cards === source.cards ? columns : columns.map((column) => (column.id === source.id ? { ...column, cards } : column));
  }
  const movedCard = source.cards.find((card) => card.id === activeId)!;
  const insertIndex = destination.cards.findIndex((card) => card.id === overId);
  return columns.map((column) => {
    if (column.id === source.id) return { ...column, cards: column.cards.filter((card) => card.id !== activeId) };
    if (column.id === destination.id) {
      const cards = [...column.cards];
      cards.splice(insertIndex < 0 ? cards.length : insertIndex, 0, movedCard);
      return { ...column, cards };
    }
    return column;
  });
}

// Card ids must match the backend's ^[a-z][a-z0-9-]{0,63}$ and be unique within the board.
export function newCardId(): string {
  return `card-${crypto.randomUUID()}`;
}

export function addCard(columns: Column[], columnId: string, title: string, details: string): Column[] {
  const card = { id: newCardId(), title, details };
  return columns.map((column) => (column.id === columnId ? { ...column, cards: [...column.cards, card] } : column));
}

export function updateCard(columns: Column[], cardId: string, title: string, details: string): Column[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => (card.id === cardId ? { ...card, title, details } : card)),
  }));
}

export function deleteCard(columns: Column[], cardId: string): Column[] {
  return columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== cardId) }));
}

export function renameColumn(columns: Column[], columnId: string, name: string): Column[] {
  return columns.map((column) => (column.id === columnId ? { ...column, name } : column));
}

export function countCards(columns: Column[]): number {
  return columns.reduce((total, column) => total + column.cards.length, 0);
}
