import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "../app/page";

describe("Home session lifecycle", () => {
  it("keeps board changes when logging out and back in", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByLabelText("Column name"));
    await user.type(screen.getByLabelText("Column name"), "Ideas");
    await user.click(screen.getByRole("button", { name: "Rename column" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument();
  });
});