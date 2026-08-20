import type { Card, Column } from "./types";

type ApiCard = Card & { position: number };
type ApiColumn = Omit<Column, "cards"> & { position: number; cards: ApiCard[] };
export type ApiBoard = {
  id: string;
  owner_id: string;
  name: string;
  columns: ApiColumn[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend-api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchBoard(userId: string): Promise<ApiBoard> {
  return request<ApiBoard>(`/users/${userId}/board`);
}

export function saveBoard(userId: string, name: string, columns: Column[]): Promise<ApiBoard> {
  return request<ApiBoard>(`/users/${userId}/board`, {
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
