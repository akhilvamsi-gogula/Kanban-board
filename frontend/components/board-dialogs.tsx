"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import type { BoardSummary, Card, Column } from "../lib/types";

type DialogFrameProps = {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
};

function DialogFrame({ title, eyebrow, onClose, children }: DialogFrameProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div><span className="dialog-eyebrow">{eyebrow}</span><h2 id="dialog-title">{title}</h2></div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

type CardFormDialogProps = {
  card?: Card;
  onClose: () => void;
  onSubmit: (title: string, details: string) => void;
};

export function CardFormDialog({ card, onClose, onSubmit }: CardFormDialogProps) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [details, setDetails] = useState(card?.details ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim()) onSubmit(title.trim(), details.trim());
  }

  return <DialogFrame eyebrow={card ? "Refine card" : "New work item"} title={card ? "Edit card" : "Add a card"} onClose={onClose}>
    <form className="dialog-form" onSubmit={handleSubmit}>
      <label>Title<input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Prepare launch notes" /></label>
      <label>Details<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What does good look like?" rows={4} /></label>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">{card ? "Save changes" : "Add card"}</button></div>
    </form>
  </DialogFrame>;
}

type RenameDialogProps = { column: Column; onClose: () => void; onSubmit: (name: string) => void };

export function RenameColumnDialog({ column, onClose, onSubmit }: RenameDialogProps) {
  const [name, setName] = useState(column.name);
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (name.trim()) onSubmit(name.trim()); }
  return <DialogFrame eyebrow="Board structure" title="Rename column" onClose={onClose}>
    <form className="dialog-form" onSubmit={handleSubmit}><label>Column name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Rename column</button></div></form>
  </DialogFrame>;
}

type DeleteDialogProps = { card: Card; onClose: () => void; onConfirm: () => void };

export function DeleteCardDialog({ card, onClose, onConfirm }: DeleteDialogProps) {
  return <DialogFrame eyebrow="This cannot be undone" title="Delete this card?" onClose={onClose}><div className="delete-copy"><p><strong>{card.title}</strong> will be removed from the board.</p></div><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Keep card</button><button type="button" className="button button-danger" onClick={onConfirm}>Delete card</button></div></DialogFrame>;
}

type BoardNameDialogProps = { title: string; submitLabel: string; initialName?: string; placeholder?: string; onClose: () => void; onSubmit: (name: string) => void };

export function BoardNameDialog({ title, submitLabel, initialName = "", placeholder, onClose, onSubmit }: BoardNameDialogProps) {
  const [name, setName] = useState(initialName);
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (name.trim()) onSubmit(name.trim()); }
  return <DialogFrame eyebrow="Board structure" title={title} onClose={onClose}>
    <form className="dialog-form" onSubmit={handleSubmit}><label>Board name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} /></label><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">{submitLabel}</button></div></form>
  </DialogFrame>;
}

type DeleteBoardDialogProps = { board: BoardSummary; onClose: () => void; onConfirm: () => void };

export function DeleteBoardDialog({ board, onClose, onConfirm }: DeleteBoardDialogProps) {
  return <DialogFrame eyebrow="This cannot be undone" title="Delete this board?" onClose={onClose}><div className="delete-copy"><p><strong>{board.name}</strong> and all of its cards will be removed.</p></div><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Keep board</button><button type="button" className="button button-danger" onClick={onConfirm}>Delete board</button></div></DialogFrame>;
}
