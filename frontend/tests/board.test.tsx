import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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

});
