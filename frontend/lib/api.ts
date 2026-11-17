import type { BoardSummary, Card, Column } from "./types";

type ApiCard = Card & { position: number };
type ApiColumn = Omit<Column, "cards"> & { position: number; cards: ApiCard[] };
export type ApiBoard = {
  id: string;
  owner_id: string;
  name: string;
  columns: ApiColumn[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend-api";

async function parseErrorDetail(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: string | Array<{ msg?: string; loc?: Array<string | number> }> } | null;
  const detail = Array.isArray(body?.detail)
    ? body.detail.map((item) => item.msg ?? "Invalid request").join("; ")
    : body?.detail;
  return detail ?? `Request failed (${response.status})`;
}

// Called when a request that needs a session gets a 401: the session expired, or a password
// reset on another device signed this one out. page.tsx uses it to return to sign-in.
let sessionExpiredListener: (() => void) | null = null;

export function onSessionExpired(listener: (() => void) | null): void {
  sessionExpiredListener = listener;
}

async function request<T>(path: string, options?: RequestInit & { parseJson?: boolean }): Promise<T> {
  const { parseJson = true, ...init } = options ?? {};
  // FormData needs the browser to set its own multipart Content-Type (with the boundary).
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
  });
  // A 401 from /auth/* is a wrong password or token, not a lost session.
  if (response.status === 401 && !path.startsWith("/auth/")) sessionExpiredListener?.();
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  if (!parseJson) return undefined as T;
  return response.json() as Promise<T>;
}

// Resolves once the backend answers. Render's free tier sleeps after 15 idle minutes and takes
// ~30-50s to boot; meanwhile the proxy either holds the request or answers with a 5xx (the local
// Next.js rewrite returns 500 when nothing is listening; Vercel/Render return 502-504). /api/health
// does no work and cannot fail by itself, so any 5xx, network error or timeout means "still
// waking" and is retried. Any other response, even a 404 from an older backend without
// /api/health, means the server is up. The first request is also what wakes the server, so
// this is called as soon as the page loads.
export async function waitForBackend({ timeoutMs = 90_000, attemptTimeoutMs = 10_000, retryDelayMs = 1_500 } = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(attemptTimeoutMs) });
      if (response.status < 500) return;
    } catch {
      // network error or attempt timeout - the server is still starting
    }
    if (Date.now() + retryDelayMs >= deadline) throw new Error("The server did not respond in time.");
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

export type AuthUser = {
  id: string;
  username: string;
};

export function signUp(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signIn(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signOut(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST", parseJson: false });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return response.json() as Promise<AuthUser>;
}

export type ForgotPasswordResponse = {
  message: string;
  reset_token: string | null;
};

export function forgotPassword(username: string): Promise<ForgotPasswordResponse> {
  return request<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return request<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
    parseJson: false,
  });
}

export function listBoards(): Promise<BoardSummary[]> {
  return request<BoardSummary[]>("/boards");
}

export function createBoard(name: string): Promise<ApiBoard> {
  return request<ApiBoard>("/boards", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function fetchBoard(boardId: string): Promise<ApiBoard> {
  return request<ApiBoard>(`/boards/${boardId}`);
}

// UI -> wire shape: array order is the frontend's source of truth, explicit positions the API's.
export function toApiColumns(columns: Column[]): ApiColumn[] {
  return columns.map((column, columnIndex) => ({
    ...column,
    position: columnIndex,
    cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
  }));
}

export function saveBoard(boardId: string, name: string, columns: Column[]): Promise<ApiBoard> {
  return request<ApiBoard>(`/boards/${boardId}`, {
    method: "PUT",
    body: JSON.stringify({ name, columns: toApiColumns(columns) }),
  });
}

export function deleteBoard(boardId: string): Promise<void> {
  return request<void>(`/boards/${boardId}`, { method: "DELETE", parseJson: false });
}

export function renameBoard(boardId: string, name: string): Promise<ApiBoard> {
  return request<ApiBoard>(`/boards/${boardId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

// Always the complete board after the backend merged and validated the model's update.
export type AiBoardUpdate = {
  name: string;
  columns: ApiColumn[];
};

// One line of what an AI update changes, computed by the backend from the before and after
// boards, not written by the model.
export type BoardChange = {
  kind: "board_renamed" | "column_renamed" | "card_added" | "card_removed" | "card_moved" | "card_renamed" | "card_details_changed" | "cards_reordered";
  text: string;
};

export type AiChatResponse = {
  assistant_message: string;
  board_update?: AiBoardUpdate | null;
  changes?: BoardChange[];
};

// Text the backend extracted from one attached file; nothing is stored server-side.
export type AttachmentText = {
  name: string;
  text: string;
  truncated: boolean;
};

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = [
  ".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".webp",
  ".txt", ".md", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".html", ".log",
].join(",");

export function uploadAttachment(file: File): Promise<AttachmentText> {
  const body = new FormData();
  body.append("file", file);
  return request<AttachmentText>("/ai/attachments", { method: "POST", body });
}

export function askBoardAssistant(prompt: string, board: ApiBoard, history: AiMessage[] = [], attachments: AttachmentText[] = []): Promise<AiChatResponse> {
  return request<AiChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ prompt, board, history, attachments }),
  });
}

// Wire -> UI shape: sort by position, then drop it.
export function toColumns(board: { columns: ApiColumn[] }): Column[] {
  return board.columns
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((column) => ({
      id: column.id,
      name: column.name,
      accent: column.accent,
      cards: column.cards.slice().sort((left, right) => left.position - right.position).map((card) => ({
        id: card.id,
        title: card.title,
        details: card.details,
      })),
    }));
}
