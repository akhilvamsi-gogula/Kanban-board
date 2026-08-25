"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createBoard, deleteBoard, fetchBoard, getCurrentUser, listBoards, renameBoard, saveBoard, signOut, toColumns } from "../lib/api";
import type { BoardSummary, Column } from "../lib/types";

const Board = dynamic(() => import("../components/board").then((module) => module.Board), { ssr: false });
const SignIn = dynamic(() => import("../components/sign-in").then((module) => module.SignIn), { ssr: false });

export default function Home() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [boardName, setBoardName] = useState("My board");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ boardId: string; next: Column[]; previous: Column[] } | null>(null);
  const [boardActionError, setBoardActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // persistBoard needs the board that is active when its PUT *resolves*, not the one
  // captured in the closure when it started, to detect a save it should discard.
  const activeBoardIdRef = useRef(activeBoardId);
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setIsSignedIn(user !== null);
        setUsername(user?.username);
      })
      .catch(() => {
        if (active) setIsSignedIn(false);
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    listBoards()
      .then((list) => {
        if (!active) return;
        setBoards(list);
        setActiveBoardId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => { active = false; };
  }, [isSignedIn]);

  useEffect(() => {
    if (!activeBoardId) return;
    let active = true;
    fetchBoard(activeBoardId)
      .then((board) => {
        if (!active) return;
        setOwnerId(board.owner_id);
        setBoardName(board.name);
        setColumns(toColumns(board));
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => { active = false; };
  }, [activeBoardId]);

  async function persistBoard(nextColumns: Column[], previousColumns: Column[]) {
    const boardId = activeBoardId;
    if (!boardId) return;
    setColumns(nextColumns);
    setSaveError(null);
    setIsSaving(true);
    try {
      const board = await saveBoard(boardId, boardName, nextColumns);
      if (boardId !== activeBoardIdRef.current) return;
      setBoardName(board.name);
      setColumns(toColumns(board));
    } catch {
      if (boardId !== activeBoardIdRef.current) return;
      setColumns(previousColumns);
      setSaveError({ boardId, next: nextColumns, previous: previousColumns });
    } finally {
      setIsSaving(false);
    }
  }

  function retrySave() {
    if (saveError) void persistBoard(saveError.next, saveError.previous);
  }

  function switchBoard(boardId: string) {
    if (boardId === activeBoardId) return;
    setSaveError(null);
    setLoadError(null);
    setColumns(null);
    setActiveBoardId(boardId);
  }

  async function runBoardAction(fallbackMessage: string, action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setBoardActionError(error instanceof Error ? error.message : fallbackMessage);
    }
  }

  function handleCreateBoard(name: string) {
    return runBoardAction("Could not create board.", async () => {
      const board = await createBoard(name);
      setBoards((current) => [...(current ?? []), { id: board.id, name: board.name }]);
      switchBoard(board.id);
    });
  }

  function handleDeleteBoard(boardId: string) {
    return runBoardAction("Could not delete board.", async () => {
      await deleteBoard(boardId);
      const remaining = (boards ?? []).filter((board) => board.id !== boardId);
      setBoards(remaining);
      if (boardId === activeBoardId && remaining[0]) switchBoard(remaining[0].id);
    });
  }

  function handleRenameBoard(boardId: string, name: string) {
    return runBoardAction("Could not rename board.", async () => {
      const board = await renameBoard(boardId, name);
      setBoards((current) => (current ?? []).map((item) => (item.id === boardId ? { ...item, name: board.name } : item)));
      if (boardId === activeBoardId) setBoardName(board.name);
    });
  }

  function clearBoardState() {
    setBoards(null);
    setActiveBoardId(null);
    setOwnerId(undefined);
    setColumns(null);
  }

  function handleAuthenticated(user: { username: string }) {
    clearBoardState();
    setLoadError(null);
    setUsername(user.username);
    setIsSignedIn(true);
  }

  async function handleLogout() {
    setIsSignedIn(false);
    clearBoardState();
    setUsername(undefined);
    try {
      await signOut();
    } catch {
      // best-effort: local session state is already cleared
    }
  }

  if (isCheckingSession) {
    return <main className="state-shell"><p>Loading...</p></main>;
  }

  return (
    <>
      <Board
        isVisible={isSignedIn && columns !== null && !loadError}
        boardName={boardName}
        boardId={activeBoardId ?? undefined}
        ownerId={ownerId}
        username={username}
        columns={columns ?? undefined}
        onColumnsChange={(next, previous) => void persistBoard(next, previous)}
        onBoardNameChange={setBoardName}
        onLogout={() => void handleLogout()}
        switcher={boards ? {
          boards,
          activeBoardId,
          onSwitch: switchBoard,
          onCreate: (name) => void handleCreateBoard(name),
          onDelete: (boardId) => void handleDeleteBoard(boardId),
          onRename: (boardId, name) => void handleRenameBoard(boardId, name),
        } : undefined}
      />
      {isSignedIn && !columns && !loadError && <main className="state-shell"><p>Loading your board...</p></main>}
      {isSignedIn && loadError && <main className="state-shell"><h1>Unable to load your board</h1><p>{loadError}</p><button type="button" className="button button-primary" onClick={() => setIsSignedIn(false)}>Back to sign in</button></main>}
      {isSignedIn && saveError && saveError.boardId === activeBoardId && <div className="save-error" role="alert"><span>Could not save your latest change.</span><button type="button" className="button button-quiet button-small" onClick={retrySave} disabled={isSaving}>Retry</button></div>}
      {isSignedIn && boardActionError && <div className="save-error" role="alert"><span>{boardActionError}</span><button type="button" className="button button-quiet button-small" onClick={() => setBoardActionError(null)}>Dismiss</button></div>}
      {isSignedIn && isSaving && <div className="save-status" role="status">Saving...</div>}
      {!isSignedIn && <SignIn onSignIn={handleAuthenticated} />}
    </>
  );
}
