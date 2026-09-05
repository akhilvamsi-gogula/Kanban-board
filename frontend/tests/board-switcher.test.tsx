import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardSwitcher } from "../components/board-switcher";

const oneBoard = [{ id: "board-1", name: "Only board" }];
const twoBoards = [
  { id: "board-1", name: "First board" },
  { id: "board-2", name: "Second board" },
];

describe("BoardSwitcher", () => {
  it("hides the delete button when only one board exists", async () => {
    const user = userEvent.setup();
    render(
      <BoardSwitcher boards={oneBoard} activeBoardId="board-1" onSwitch={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /Only board/ }));

    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });

  it("shows a delete button per board once more than one board exists", async () => {
    const user = userEvent.setup();
    render(
      <BoardSwitcher boards={twoBoards} activeBoardId="board-1" onSwitch={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /First board/ }));

    expect(screen.getByRole("button", { name: "Delete First board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Second board" })).toBeInTheDocument();
  });

  it("does not create a board when the name is only whitespace", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <BoardSwitcher boards={oneBoard} activeBoardId="board-1" onSwitch={vi.fn()} onCreate={onCreate} onDelete={vi.fn()} onRename={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /Only board/ }));
    await user.click(screen.getByRole("button", { name: "New board" }));
    await user.type(screen.getByLabelText("Board name"), "   ");
    await user.click(screen.getByRole("button", { name: "Create board" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "New board" })).toBeInTheDocument();
  });

  it("confirms before deleting a board and only calls onDelete after confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <BoardSwitcher boards={twoBoards} activeBoardId="board-1" onSwitch={vi.fn()} onCreate={vi.fn()} onDelete={onDelete} onRename={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /First board/ }));
    await user.click(screen.getByRole("button", { name: "Delete First board" }));
    expect(screen.getByRole("heading", { name: "Delete this board?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep board" }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /First board/ }));
    await user.click(screen.getByRole("button", { name: "Delete First board" }));
    await user.click(screen.getByRole("button", { name: "Delete board" }));
    expect(onDelete).toHaveBeenCalledWith("board-1");
  });
});
