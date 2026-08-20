"use client";

import { useEffect, useState } from "react";
import { Board } from "../components/board";
import { SignIn } from "../components/sign-in";
import { fetchBoard, saveBoard, toColumns } from "../lib/api";
import type { Column } from "../lib/types";

const USER_ID = "demo-user";

export default function Home() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [columns, setColumns] = useState<Column[] | null>(null);
  const [boardName, setBoardName] = useState("Q3 product launch");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ next: Column[]; previous: Column[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    fetchBoard(USER_ID)
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
      const board = await saveBoard(USER_ID, boardName, nextColumns);
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

  function signIn() {
    setColumns(null);
    setLoadError(null);
    setIsSignedIn(true);
  }

  return (
    <>
      <Board
        isVisible={isSignedIn && columns !== null && !loadError}
        boardName={boardName}
        columns={columns ?? undefined}
        onColumnsChange={(next, previous) => void persistBoard(next, previous)}
        onLogout={() => setIsSignedIn(false)}
      />
      {isSignedIn && !columns && !loadError && <main className="state-shell"><p>Loading your board...</p></main>}
      {isSignedIn && loadError && <main className="state-shell"><h1>Unable to load your board</h1><p>{loadError}</p><button type="button" className="button button-primary" onClick={() => setIsSignedIn(false)}>Back to sign in</button></main>}
      {isSignedIn && saveError && <div className="save-error" role="alert"><span>Could not save your latest change.</span><button type="button" className="button button-quiet button-small" onClick={retrySave} disabled={isSaving}>Retry</button></div>}
      {isSignedIn && isSaving && <div className="save-status" role="status">Saving...</div>}
      {!isSignedIn && <SignIn onSignIn={signIn} />}
    </>
  );
}
