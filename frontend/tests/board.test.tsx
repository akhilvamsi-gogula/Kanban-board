import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Board, reorderCards } from "../components/board";
import { initialColumns } from "../lib/initial-data";

describe("Board", () => {
  it("renders five seeded columns and their cards", () => {
    render(<Board isVisible onLogout={() => undefined} />);
    expect(document.querySelectorAll(".column")).toHaveLength(5);
    expect(screen.getByText("Map the user journey")).toBeInTheDocument();
    expect(screen.getByText("Align with the team")).toBeInTheDocument();
  });

  it("adds a card to the chosen column", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(document.querySelector(".toolbar-add") as HTMLButtonElement);
    await user.type(screen.getByLabelText("Title"), "Plan the demo");
    await user.type(screen.getByLabelText("Details"), "Prepare the walkthrough for Friday.");
    await user.click(document.querySelector(".dialog-form .button-primary") as HTMLButtonElement);
    expect(screen.getByText("Plan the demo")).toBeInTheDocument();
  });

  it("renames a column and edits a card", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    const columnInput = screen.getByLabelText("Column name");
    await user.clear(columnInput);
    await user.type(columnInput, "Ideas");
    await user.click(screen.getByRole("button", { name: "Rename column" }));
    expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Map the user journey" }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Map the customer journey");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Map the customer journey")).toBeInTheDocument();
  });

  it("requires confirmation before deleting a card", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Delete Review product analytics" }));
    expect(screen.getByRole("heading", { name: "Delete this card?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep card" }));
    expect(screen.getByText("Review product analytics")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Review product analytics" }));
    await user.click(screen.getByRole("button", { name: "Delete card" }));
    expect(screen.queryByText("Review product analytics")).not.toBeInTheDocument();
  });

  it("exposes keyboard drag handles for sortable cards", () => {
    render(<Board isVisible onLogout={() => undefined} />);

    expect(screen.getByRole("button", { name: "Drag Map the user journey" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drag Align with the team" })).toBeInTheDocument();
  });

  it("reorders cards within a column", () => {
    const cards = initialColumns[0].cards;
    const reordered = reorderCards(cards, "map-user-journey", "review-analytics");

    expect(reordered.map((card) => card.id)).toEqual(["review-analytics", "map-user-journey"]);
  });

  it("reorderCards returns the cards unchanged when either id cannot be found", () => {
    const cards = initialColumns[0].cards;

    expect(reorderCards(cards, "does-not-exist", cards[0].id)).toBe(cards);
    expect(reorderCards(cards, cards[0].id, "does-not-exist")).toBe(cards);
  });

  it("does not add a card when the title is only whitespace", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(document.querySelector(".toolbar-add") as HTMLButtonElement);
    await user.type(screen.getByLabelText("Title"), "   ");
    await user.click(document.querySelector(".dialog-form .button-primary") as HTMLButtonElement);

    expect(screen.getByRole("heading", { name: "Add a card" })).toBeInTheDocument();
  });

  it("does not rename a column to a whitespace-only name", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    const columnInput = screen.getByLabelText("Column name");
    await user.clear(columnInput);
    await user.type(columnInput, "   ");
    await user.click(screen.getByRole("button", { name: "Rename column" }));

    expect(screen.getByRole("heading", { name: "Rename column" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Backlog" })).toBeInTheDocument();
  });

  describe("AI undo", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("reverts the last AI board update locally, without asking the AI to reconstruct it", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          assistant_message: "Moved every card to Done.",
          board_update: {
            name: "Q3 product launch",
            columns: initialColumns.map((column, index) => ({
              id: column.id,
              name: column.name,
              accent: column.accent,
              position: index,
              cards: column.id === "done" ? initialColumns.flatMap((c) => c.cards).map((card, i) => ({ ...card, position: i })) : [],
            })),
          },
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));

      await user.type(screen.getByLabelText("Ask the board assistant"), "move all boards to done");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await within(screen.getByRole("region", { name: "Done" })).findByText("Map the user journey")).toBeInTheDocument();
      expect(within(screen.getByRole("region", { name: "Backlog" })).queryByText("Map the user journey")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await user.type(screen.getByLabelText("Ask the board assistant"), "undo the action");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await within(screen.getByRole("region", { name: "Backlog" })).findByText("Map the user journey")).toBeInTheDocument();
      expect(within(screen.getByRole("region", { name: "Done" })).queryByText("Map the user journey")).not.toBeInTheDocument();
      expect(screen.getByText("Reverted the last board update I made.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("tells the user there is nothing to undo when no AI update has been applied yet", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await user.type(screen.getByLabelText("Ask the board assistant"), "undo");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("There's nothing from me to undo yet.")).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
