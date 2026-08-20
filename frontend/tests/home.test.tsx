import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { initialColumns } from "../lib/initial-data";

describe("Home session lifecycle", () => {
  it("keeps board changes when logging out and back in", async () => {
    const user = userEvent.setup();
    const apiBoard = {
      id: "q3-product-launch",
      owner_id: "demo-user",
      name: "Q3 product launch",
      columns: initialColumns.map((column, columnIndex) => ({
        ...column,
        position: columnIndex,
        cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
      })),
    };
    let storedBoard = apiBoard;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === "PUT") {
        storedBoard = { ...storedBoard, ...JSON.parse(String(options.body)) };
      }
      return { ok: true, json: async () => storedBoard };
    }));
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
    vi.unstubAllGlobals();
  });

  it("shows a load error when the board API is unavailable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Backend unavailable")));
    render(<Home />);

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(await screen.findByRole("heading", { name: "Unable to load your board" })).toBeInTheDocument();
    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows an AI assistant panel for board prompts after sign-in", async () => {
    const user = userEvent.setup();
    let chatRequest: { prompt: string; history: Array<{ role: string; content: string }> } | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === "PUT") return { ok: true, json: async () => ({}) };
      if (options?.method === "POST") {
        const body = JSON.parse(String(options.body)) as typeof chatRequest;
        chatRequest = body;
        return { ok: true, json: async () => ({ assistant_message: "There are 8 cards on this board." }) };
      }
      return { ok: true, json: async () => ({
        id: "q3-product-launch",
        owner_id: "demo-user",
        name: "Q3 product launch",
        columns: initialColumns.map((column, columnIndex) => ({
          ...column,
          position: columnIndex,
          cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
        })),
      }) };
    }));
    render(<Home />);

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(await screen.findByRole("button", { name: "AI assistant" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "AI assistant" }));
    expect(screen.getByRole("heading", { name: "AI assistant" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ask the board assistant")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Ask the board assistant"), "How many cards are there?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("There are 8 cards on this board.")).toBeInTheDocument();
    expect(chatRequest).not.toBeNull();
    const submittedRequest = chatRequest as unknown as { prompt: string; history: Array<{ role: string; content: string }> };
    expect(submittedRequest.prompt).toBe("How many cards are there?");
    expect(submittedRequest.history.some((message) => message.content === "How many cards are there?")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rolls back a failed save and retries it", async () => {
    const user = userEvent.setup();
    const apiBoard = {
      id: "q3-product-launch",
      owner_id: "demo-user",
      name: "Q3 product launch",
      columns: initialColumns.map((column, columnIndex) => ({
        ...column,
        position: columnIndex,
        cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
      })),
    };
    let putAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === "PUT" && putAttempts++ === 0) throw new Error("Save failed");
      return { ok: true, json: async () => apiBoard };
    }));
    render(<Home />);

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));
    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByLabelText("Column name"));
    await user.type(screen.getByLabelText("Column name"), "Ideas");
    await user.click(screen.getByRole("button", { name: "Rename column" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Backlog" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});