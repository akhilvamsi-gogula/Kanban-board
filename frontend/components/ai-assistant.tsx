"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { askBoardAssistant, toApiColumns, toColumns, type AiMessage } from "../lib/api";
import type { Column } from "../lib/types";

const UNDO_REQUEST_PATTERN = /\bundo\b/i;
const HISTORY_SENT = 8;

type AiAssistantProps = {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  ownerId: string;
  boardName: string;
  columns: Column[];
  onApplyBoard: (columns: Column[], boardName: string) => void;
};

// Stays mounted while closed so the conversation survives closing and reopening the panel.
export function AiAssistant({ isOpen, onClose, boardId, ownerId, boardName, columns, onApplyBoard }: AiAssistantProps) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "Ask me to rename a column, add a task, or update the board." },
  ]);
  const [snapshot, setSnapshot] = useState<{ columns: Column[]; boardName: string } | null>(null);

  function reply(content: string) {
    setMessages((current) => [...current, { role: "assistant", content }]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isLoading) return;

    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setDraft("");
    setError(null);

    // The AI is never shown prior board states, only the current one plus text history, so it
    // cannot reconstruct an earlier layout - "undo" is handled locally from a real snapshot instead.
    if (UNDO_REQUEST_PATTERN.test(prompt)) {
      if (snapshot) {
        onApplyBoard(snapshot.columns, snapshot.boardName);
        setSnapshot(null);
        reply("Reverted the last board update I made.");
      } else {
        reply("There's nothing from me to undo yet.");
      }
      return;
    }

    setIsLoading(true);
    try {
      const board = { id: boardId, owner_id: ownerId, name: boardName, columns: toApiColumns(columns) };
      const response = await askBoardAssistant(prompt, board, messages.slice(-HISTORY_SENT));
      reply(response.assistant_message);
      if (response.board_update) {
        setSnapshot({ columns, boardName });
        onApplyBoard(toColumns(response.board_update), response.board_update.name);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant could not answer right now.");
      reply("I hit a problem trying to update the board. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <button type="button" className="ai-backdrop" aria-label="Close AI assistant" onClick={onClose} />
      <aside className="ai-panel" aria-label="AI assistant panel">
        <div className="ai-header">
          <div className="ai-title">
            <span className="ai-title-icon"><Bot size={19} /></span>
            <div>
              <span className="section-label">AI co-pilot</span>
              <h2>AI assistant</h2>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Close AI assistant" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <p className="ai-intro">Your board is in context. Ask a question or describe a change and I will help you make it happen.</p>
        <div className="ai-messages" role="log" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-message ai-message-${message.role}`}>
              <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
        {error && <p className="ai-error">{error}</p>}
        <form className="ai-composer" onSubmit={handleSubmit}>
          <label htmlFor="assistant-prompt" className="sr-only">Ask the board assistant</label>
          <textarea
            id="assistant-prompt"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Ask the board assistant to rename a column, add a task, or reorder cards"
            aria-label="Ask the board assistant"
            disabled={isLoading}
          />
          <div className="ai-actions">
            <button type="button" className="button button-quiet button-small" onClick={() => setDraft("")} disabled={isLoading}>
              Clear
            </button>
            <button type="submit" className="button button-primary button-small" disabled={isLoading}>
              {isLoading ? "Thinking..." : <><Send size={14} /> Send</>}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
