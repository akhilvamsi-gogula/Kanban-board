"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { BoardSummary } from "../lib/types";
import { BoardNameDialog, DeleteBoardDialog } from "./board-dialogs";

export type BoardSwitcherProps = {
  boards: BoardSummary[];
  activeBoardId: string | null;
  onSwitch: (boardId: string) => void;
  onCreate: (name: string) => void;
  onDelete: (boardId: string) => void;
  onRename: (boardId: string, name: string) => void;
};

export function BoardSwitcher({ boards, activeBoardId, onSwitch, onCreate, onDelete, onRename }: BoardSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<BoardSummary | null>(null);
  const activeBoard = boards.find((board) => board.id === activeBoardId);

  return <div className="board-switcher">
    <button type="button" className="board-switcher-trigger" onClick={() => setIsOpen((current) => !current)} aria-haspopup="true" aria-expanded={isOpen}>{activeBoard?.name ?? "Boards"} <ChevronDown size={14} /></button>
    {isOpen && <>
      <button type="button" className="board-switcher-backdrop" aria-label="Close board switcher" onClick={() => setIsOpen(false)} />
      <div className="board-switcher-panel">
        {boards.map((board) => <div key={board.id} className={`board-switcher-item ${board.id === activeBoardId ? "board-switcher-item-active" : ""}`}>
          <button type="button" className="board-switcher-item-name" aria-current={board.id === activeBoardId} onClick={() => { setIsOpen(false); onSwitch(board.id); }}>{board.name}</button>
          <button type="button" className="icon-button" aria-label={`Rename ${board.name}`} onClick={() => { setIsOpen(false); setRenameTarget(board); }}><Pencil size={14} /></button>
          {boards.length > 1 && <button type="button" className="icon-button icon-button-danger" aria-label={`Delete ${board.name}`} onClick={() => { setIsOpen(false); setDeleteTarget(board); }}><Trash2 size={14} /></button>}
        </div>)}
        <div className="board-switcher-divider" />
        <button type="button" className="board-switcher-create" onClick={() => { setIsOpen(false); setIsCreateOpen(true); }}><Plus size={14} /> New board</button>
      </div>
    </>}
    {isCreateOpen && <BoardNameDialog title="New board" submitLabel="Create board" placeholder="e.g. Home renovation" onClose={() => setIsCreateOpen(false)} onSubmit={(name) => { setIsCreateOpen(false); onCreate(name); }} />}
    {renameTarget && <BoardNameDialog title="Rename board" submitLabel="Rename board" initialName={renameTarget.name} onClose={() => setRenameTarget(null)} onSubmit={(name) => { setRenameTarget(null); onRename(renameTarget.id, name); }} />}
    {deleteTarget && <DeleteBoardDialog board={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { setDeleteTarget(null); onDelete(deleteTarget.id); }} />}
  </div>;
}
