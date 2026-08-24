"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchBoard, getCurrentUser, saveBoard, signOut, toColumns } from "../lib/api";
import type { Column } from "../lib/types";

const Board = dynamic(() => import("../components/board").then((module) => module.Board), { ssr: false });
const SignIn = dynamic(() => import("../components/sign-in").then((module) => module.SignIn), { ssr: false });

export default function Home() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [boardName, setBoardName] = useState("My board");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ next: Column[]; previous: Column[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    fetchBoard()
      .then((board) => {
        if (!active) return;
        setBoardName(board.name);
        setColumns(toColumns(board));
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => { active = false; };
  }, [isSignedIn]);

  async function persistBoard(nextColumns: Column[], previousColumns: Column[]) {
    setColumns(nextColumns);
    setSaveError(null);
    setIsSaving(true);
    try {
      const board = await saveBoard(boardName, nextColumns);
      setBoardName(board.name);
      setColumns(toColumns(board));
    } catch {
      setColumns(previousColumns);
      setSaveError({ next: nextColumns, previous: previousColumns });
    } finally {
      setIsSaving(false);
    }
  }

  function retrySave() {
    if (saveError) void persistBoard(saveError.next, saveError.previous);
  }

  function handleAuthenticated(user: { username: string }) {
    setColumns(null);
    setLoadError(null);
    setUsername(user.username);
    setIsSignedIn(true);
  }

  async function handleLogout() {
    setIsSignedIn(false);
    setColumns(null);
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
        username={username}
        columns={columns ?? undefined}
        onColumnsChange={(next, previous) => void persistBoard(next, previous)}
        onBoardNameChange={setBoardName}
        onLogout={() => void handleLogout()}
      />
      {isSignedIn && !columns && !loadError && <main className="state-shell"><p>Loading your board...</p></main>}
      {isSignedIn && loadError && <main className="state-shell"><h1>Unable to load your board</h1><p>{loadError}</p><button type="button" className="button button-primary" onClick={() => setIsSignedIn(false)}>Back to sign in</button></main>}
      {isSignedIn && saveError && <div className="save-error" role="alert"><span>Could not save your latest change.</span><button type="button" className="button button-quiet button-small" onClick={retrySave} disabled={isSaving}>Retry</button></div>}
      {isSignedIn && isSaving && <div className="save-status" role="status">Saving...</div>}
      {!isSignedIn && <SignIn onSignIn={handleAuthenticated} />}
    </>
  );
}
