import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { initialColumns } from "../lib/initial-data";

type Handler = (options?: RequestInit) => { status: number; body: unknown };

function pathOf(input: RequestInfo | URL): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return url.replace(/^https?:\/\/[^/]+/, "");
}

function stubFetch(handlers: Record<string, Handler>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const key = `${options?.method ?? "GET"} ${pathOf(input)}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unhandled request: ${key}`);
    const { status, body } = handler(options);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }));
}

function makeApiBoard() {
  return {
    id: "q3-product-launch",
    owner_id: "demo-user",
    name: "Q3 product launch",
    columns: initialColumns.map((column, columnIndex) => ({
      ...column,
      position: columnIndex,
      cards: column.cards.map((card, cardIndex) => ({ ...card, position: cardIndex })),
    })),
  };
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText("Username");
  await user.type(screen.getByLabelText("Username"), "user");
  await user.type(screen.getByLabelText("Password"), "password");
  await user.click(screen.getByRole("button", { name: "Open board" }));
}

describe("Home session lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps board changes when logging out and back in", async () => {
    const user = userEvent.setup();
    let storedBoard = makeApiBoard();
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "POST /backend-api/auth/logout": () => ({ status: 200, body: {} }),
      "GET /backend-api/board": () => ({ status: 200, body: storedBoard }),
      "PUT /backend-api/board": (options) => {
        storedBoard = { ...storedBoard, ...JSON.parse(String(options?.body)) };
        return { status: 200, body: storedBoard };
      },
    });
    render(<Home />);

    await signIn(user);
    await user.click(await screen.findByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByLabelText("Column name"));
    await user.type(screen.getByLabelText("Column name"), "Ideas");
    await user.click(screen.getByRole("button", { name: "Rename column" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await signIn(user);

    expect(await screen.findByRole("heading", { name: "Ideas" })).toBeInTheDocument();
  });

  it("shows a load error when the board API is unavailable", async () => {
    const user = userEvent.setup();
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/board": () => {
        throw new Error("Backend unavailable");
      },
    });
    render(<Home />);

    await signIn(user);

    expect(await screen.findByRole("heading", { name: "Unable to load your board" })).toBeInTheDocument();
    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
  });

  it("shows an AI assistant panel for board prompts after sign-in", async () => {
    const user = userEvent.setup();
    let chatRequest: { prompt: string; history: Array<{ role: string; content: string }> } | null = null;
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/board": () => ({ status: 200, body: makeApiBoard() }),
      "PUT /backend-api/board": () => ({ status: 200, body: {} }),
      "POST /backend-api/ai/chat": (options) => {
        chatRequest = JSON.parse(String(options?.body));
        return { status: 200, body: { assistant_message: "There are 8 cards on this board." } };
      },
    });
    render(<Home />);

    await signIn(user);

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
  });

  it("rolls back a failed save and retries it", async () => {
    const user = userEvent.setup();
    const apiBoard = makeApiBoard();
    let putAttempts = 0;
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/board": () => ({ status: 200, body: apiBoard }),
      "PUT /backend-api/board": () => {
        if (putAttempts++ === 0) throw new Error("Save failed");
        return { status: 200, body: apiBoard };
      },
    });
    render(<Home />);

    await signIn(user);
    await user.click(await screen.findByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByLabelText("Column name"));
    await user.type(screen.getByLabelText("Column name"), "Ideas");
    await user.click(screen.getByRole("button", { name: "Rename column" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Backlog" })).toBeInTheDocument();
  });

  it("signs up a new account and loads its fresh board", async () => {
    const user = userEvent.setup();
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/signup": () => ({ status: 201, body: { id: "9", username: "newuser" } }),
      "GET /backend-api/board": () => ({ status: 200, body: makeApiBoard() }),
    });
    render(<Home />);

    await user.click(await screen.findByRole("button", { name: "Don't have an account? Sign up" }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Q3 product launch" })).toBeInTheDocument();
  });

  it("shows an error when signing in with the wrong password", async () => {
    const user = userEvent.setup();
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 401, body: { detail: "Invalid username or password." } }),
    });
    render(<Home />);

    await user.type(await screen.findByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(screen.queryByRole("heading", { name: "Q3 product launch" })).not.toBeInTheDocument();
  });
});
