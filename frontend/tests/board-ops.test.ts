import { describe, expect, it } from "vitest";
import { addCard, countCards, deleteCard, findCard, moveCard, newCardId, renameColumn, updateCard } from "../lib/board-ops";
import type { Column } from "../lib/types";

function board(): Column[] {
  return [
    { id: "todo", name: "To do", accent: "blue", cards: [{ id: "a", title: "A", details: "" }, { id: "b", title: "B", details: "" }] },
    { id: "doing", name: "Doing", accent: "yellow", cards: [{ id: "c", title: "C", details: "" }] },
    { id: "done", name: "Done", accent: "green", cards: [] },
  ];
}

const ids = (columns: Column[]) => columns.map((column) => column.cards.map((card) => card.id));

describe("moveCard", () => {
  it("reorders within a column when dropped on a sibling card", () => {
    expect(ids(moveCard(board(), "a", "b"))).toEqual([["b", "a"], ["c"], []]);
  });

  it("takes the place of the card it is dropped on in another column", () => {
    expect(ids(moveCard(board(), "a", "c"))).toEqual([["b"], ["a", "c"], []]);
  });

  it("appends when dropped on a column, including an empty one", () => {
    expect(ids(moveCard(board(), "a", "doing"))).toEqual([["b"], ["c", "a"], []]);
    expect(ids(moveCard(board(), "c", "done"))).toEqual([["a", "b"], [], ["c"]]);
  });

  it("can drag the last card out of a column", () => {
    const moved = moveCard(board(), "c", "a");
    expect(ids(moved)).toEqual([["c", "a", "b"], [], []]);
  });

  it("returns the same array when nothing changes", () => {
    const columns = board();
    expect(moveCard(columns, "a", "a")).toBe(columns);
    expect(moveCard(columns, "missing", "b")).toBe(columns);
    expect(moveCard(columns, "a", "missing")).toBe(columns);
  });

  it("does not mutate its input", () => {
    const columns = board();
    const before = JSON.stringify(columns);
    moveCard(columns, "a", "done");
    expect(JSON.stringify(columns)).toBe(before);
  });
});

describe("card and column edits", () => {
  it("adds a card with a backend-valid unique id to the end of a column", () => {
    const next = addCard(board(), "done", "New", "Details");
    expect(next[2].cards).toEqual([expect.objectContaining({ title: "New", details: "Details" })]);
    expect(next[2].cards[0].id).toMatch(/^[a-z][a-z0-9-]{0,63}$/);
    expect(newCardId()).not.toBe(newCardId());
  });

  it("updates, deletes and finds cards", () => {
    const updated = updateCard(board(), "c", "C2", "more");
    expect(findCard(updated, "c")).toEqual({ card: { id: "c", title: "C2", details: "more" }, columnId: "doing" });
    expect(findCard(deleteCard(updated, "c"), "c")).toBeNull();
    expect(countCards(deleteCard(updated, "c"))).toBe(2);
  });

  it("renames only the chosen column", () => {
    expect(renameColumn(board(), "doing", "In progress").map((column) => column.name)).toEqual(["To do", "In progress", "Done"]);
  });
});
