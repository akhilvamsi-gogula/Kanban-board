"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus } from "lucide-react";
import type { Card, Column } from "../lib/types";
import { TaskCard } from "./task-card";

type ColumnProps = {
  column: Column;
  onAdd: (columnId: string) => void;
  onRename: (column: Column) => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
};

export function ColumnView({ column, onAdd, onRename, onEdit, onDelete }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section className={`column ${isOver ? "column-over" : ""}`} aria-labelledby={`${column.id}-heading`}>
      <div className="column-heading">
        <div className="column-title-wrap">
          <span className="column-dot" style={{ backgroundColor: column.accent }} aria-hidden="true" />
          <h2 id={`${column.id}-heading`}>{column.name}</h2>
          <span className="column-count">{column.cards.length}</span>
        </div>
        <button type="button" className="icon-button" aria-label={`Rename ${column.name}`} onClick={() => onRename(column)}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div ref={setNodeRef} className="column-cards">
        <SortableContext items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => <TaskCard key={card.id} card={card} onEdit={onEdit} onDelete={onDelete} />)}
        </SortableContext>
        {column.cards.length === 0 && <div className="empty-column">Drop a card here</div>}
      </div>
      <button type="button" className="add-card-button" onClick={() => onAdd(column.id)}>
        <Plus size={17} /> Add card
      </button>
    </section>
  );
}
