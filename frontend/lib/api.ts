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

async function request<T>(path: string, options?: RequestInit & { parseJson?: boolean }): Promise<T> {
  const { parseJson = true, ...init } = options ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  if (!parseJson) return undefined as T;
  return response.json() as Promise<T>;
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

export function saveBoard(boardId: string, name: string, columns: Column[]): Promise<ApiBoard> {
  return request<ApiBoard>(`/boards/${boardId}`, {
    method: "PUT",
    body: JSON.stringify({
      name,
      columns: columns.map((column, columnIndex) => ({
        ...column,
        position: columnIndex,
        cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
      })),
    }),
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

export type AiBoardUpdate = {
  name: string;
  columns: ApiColumn[];
};

export type AiChatResponse = {
  assistant_message: string;
  board_update?: AiBoardUpdate;
};

export function askBoardAssistant(prompt: string, board: ApiBoard, history: AiMessage[] = []): Promise<AiChatResponse> {
  return request<AiChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      board,
      history,
    }),
  });
}

export function toColumns(board: ApiBoard): Column[] {
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
