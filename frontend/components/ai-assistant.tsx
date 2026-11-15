"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import { Bot, FileText, Paperclip, Send, X } from "lucide-react";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  askBoardAssistant,
  toApiColumns,
  toColumns,
  uploadAttachment,
  type AiMessage,
  type AttachmentText,
} from "../lib/api";
import type { Column } from "../lib/types";

const UNDO_REQUEST_PATTERN = /\bundo\b/i;
const HISTORY_SENT = 8;

type ChatEntry = AiMessage & { attachments?: string[] };

type PendingAttachment = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "ready" | "error";
  result?: AttachmentText;
  error?: string;
};

type AiAssistantProps = {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  ownerId: string;
  boardName: string;
  columns: Column[];
  onApplyBoard: (columns: Column[], boardName: string) => void;
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

// Stays mounted while closed so the conversation survives closing and reopening the panel.
export function AiAssistant({ isOpen, onClose, boardId, ownerId, boardName, columns, onApplyBoard }: AiAssistantProps) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([
    { role: "assistant", content: "Ask me to rename a column, add a task, or update the board. You can also attach a document and ask me to turn it into cards." },
  ]);
  const [snapshot, setSnapshot] = useState<{ columns: Column[]; boardName: string } | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = attachments.some((attachment) => attachment.status === "uploading");

  function reply(content: string) {
    setMessages((current) => [...current, { role: "assistant", content }]);
  }

  function updateAttachment(id: string, changes: Partial<PendingAttachment>) {
    setAttachments((current) => current.map((attachment) => (attachment.id === id ? { ...attachment, ...changes } : attachment)));
  }

  // Each file uploads straight away; the extracted text is held here until the next message.
  function addFiles(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) setError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
    const accepted = files.slice(0, Math.max(0, room));
    const added = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      status: file.size > MAX_ATTACHMENT_BYTES ? "error" : "uploading",
      error: file.size > MAX_ATTACHMENT_BYTES ? `Larger than ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB` : undefined,
    } satisfies PendingAttachment));
    setAttachments((current) => [...current, ...added]);
    added.forEach((attachment, index) => {
      if (attachment.status !== "uploading") return;
      uploadAttachment(accepted[index])
        .then((result) => updateAttachment(attachment.id, { status: "ready", result }))
        .catch((caught) => updateAttachment(attachment.id, {
          status: "error",
          error: caught instanceof Error ? caught.message : "Could not read this file.",
        }));
    });
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setIsDragOver(false);
    if (!isLoading) addFiles(Array.from(event.dataTransfer.files));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isLoading || isUploading) return;

    const ready = attachments.flatMap((attachment) => (attachment.status === "ready" && attachment.result ? [attachment.result] : []));
    setMessages((current) => [...current, { role: "user", content: prompt, attachments: ready.map((attachment) => attachment.name) }]);
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
      // Attachments go with this message only; history carries just the text of earlier turns.
      const history = messages.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content }));
      const response = await askBoardAssistant(prompt, board, history, ready);
      reply(response.assistant_message);
      setAttachments([]);
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
      <aside
        className={`ai-panel ${isDragOver ? "ai-panel-drop" : ""}`}
        aria-label="AI assistant panel"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
              {message.attachments && message.attachments.length > 0 && (
                <p className="ai-message-files"><Paperclip size={12} /> {message.attachments.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
        {error && <p className="ai-error">{error}</p>}
        <form className="ai-composer" onSubmit={handleSubmit}>
          {attachments.length > 0 && (
            <ul className="ai-attachments" aria-label="Attached files">
              {attachments.map((attachment) => (
                <li key={attachment.id} className={`ai-attachment ai-attachment-${attachment.status}`}>
                  <FileText size={14} />
                  <span className="ai-attachment-name" title={attachment.name}>{attachment.name}</span>
                  <span className="ai-attachment-status">
                    {attachment.status === "uploading" && "Reading..."}
                    {attachment.status === "ready" && (attachment.result?.truncated ? "Shortened" : formatSize(attachment.size))}
                    {attachment.status === "error" && attachment.error}
                  </span>
                  <button type="button" className="icon-button" aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment.id)}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachments.length > 0 && (
            // Files are not resent on later turns (shared token budget), so say so up front.
            <p className="ai-attachments-note">Files are read with your next message only. Attach them again to ask a follow-up about them.</p>
          )}
          <label htmlFor="assistant-prompt" className="sr-only">Ask the board assistant</label>
          <textarea
            id="assistant-prompt"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ask the board assistant to rename a column, add a task, or reorder cards"
            aria-label="Ask the board assistant"
            disabled={isLoading}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            hidden
            data-testid="attachment-input"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <div className="ai-actions">
            <button
              type="button"
              className="button button-quiet button-small ai-attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || attachments.length >= MAX_ATTACHMENTS}
              title="PDF, Word, Excel, PowerPoint, images or text, up to 4 MB each"
            >
              <Paperclip size={14} /> Attach
            </button>
            <button type="button" className="button button-quiet button-small" onClick={() => setDraft("")} disabled={isLoading}>
              Clear
            </button>
            <button type="submit" className="button button-primary button-small" disabled={isLoading || isUploading}>
              {isLoading ? "Thinking..." : <><Send size={14} /> Send</>}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
