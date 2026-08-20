"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit3, GripVertical, Trash2 } from "lucide-react";
import type { Card } from "../lib/types";

type TaskCardProps = {
  card: Card;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
};

export function TaskCard({ card, onEdit, onDelete }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-card group ${isDragging ? "task-card-dragging" : ""}`}
      {...attributes}
    >
      <div className="task-card-topline">
        <button className="drag-handle" type="button" aria-label={`Drag ${card.title}`} {...listeners}>
          <GripVertical size={17} strokeWidth={1.8} />
        </button>
        <div className="card-actions">
          <button type="button" className="icon-button" aria-label={`Edit ${card.title}`} onClick={() => onEdit(card)}>
            <Edit3 size={15} />
          </button>
          <button type="button" className="icon-button icon-button-danger" aria-label={`Delete ${card.title}`} onClick={() => onDelete(card)}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <h3>{card.title}</h3>
      <p>{card.details}</p>
    </article>
  );
}
