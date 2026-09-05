import { render, screen, waitFor, within } from "@testing-library/react";
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

function makeApiBoard(id = "q3-product-launch", name = "Q3 product launch") {
  return {
    id,
    owner_id: "demo-user",
    name,
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
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: storedBoard.id, name: storedBoard.name }] }),
      "GET /backend-api/boards/q3-product-launch": () => ({ status: 200, body: storedBoard }),
      "PUT /backend-api/boards/q3-product-launch": (options) => {
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
      "GET /backend-api/boards": () => {
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
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: "q3-product-launch", name: "Q3 product launch" }] }),
      "GET /backend-api/boards/q3-product-launch": () => ({ status: 200, body: makeApiBoard() }),
      "PUT /backend-api/boards/q3-product-launch": () => ({ status: 200, body: {} }),
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

  it("does not carry AI assistant chat history over to a different account signing in afterward", async () => {
    const user = userEvent.setup();
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": (options) => {
        const { username } = JSON.parse(String(options?.body));
        return { status: 200, body: { id: username === "alice" ? "1" : "2", username } };
      },
      "POST /backend-api/auth/logout": () => ({ status: 200, body: {} }),
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: "q3-product-launch", name: "Q3 product launch" }] }),
      "GET /backend-api/boards/q3-product-launch": () => ({ status: 200, body: makeApiBoard() }),
      "POST /backend-api/ai/chat": () => ({ status: 200, body: { assistant_message: "Added five random test cards across all columns." } }),
    });
    render(<Home />);

    await screen.findByLabelText("Username");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    await user.click(await screen.findByRole("button", { name: "AI assistant" }));
    await user.type(screen.getByLabelText("Ask the board assistant"), "Add random cards for testing");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Added five random test cards across all columns.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Log out" }));

    await screen.findByLabelText("Username");
    await user.type(screen.getByLabelText("Username"), "bob");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    await user.click(await screen.findByRole("button", { name: "AI assistant" }));
    expect(screen.queryByText("Add random cards for testing")).not.toBeInTheDocument();
    expect(screen.queryByText("Added five random test cards across all columns.")).not.toBeInTheDocument();
    expect(screen.getByText("Ask me to rename a column, add a task, or update the board.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask the board assistant")).toHaveValue("");
  });

  it("rolls back a failed save and retries it", async () => {
    const user = userEvent.setup();
    const apiBoard = makeApiBoard();
    let putAttempts = 0;
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: apiBoard.id, name: apiBoard.name }] }),
      "GET /backend-api/boards/q3-product-launch": () => ({ status: 200, body: apiBoard }),
      "PUT /backend-api/boards/q3-product-launch": () => {
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
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: "q3-product-launch", name: "Q3 product launch" }] }),
      "GET /backend-api/boards/q3-product-launch": () => ({ status: 200, body: makeApiBoard() }),
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

  it("creates a second board and switches to it", async () => {
    const user = userEvent.setup();
    const firstBoard = makeApiBoard("board-one", "First board");
    const secondBoard = makeApiBoard("board-two", "Second board");
    secondBoard.columns = secondBoard.columns.map((column) => ({ ...column, cards: [] }));
    let boards = [{ id: firstBoard.id, name: firstBoard.name }];
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/boards": () => ({ status: 200, body: boards }),
      "GET /backend-api/boards/board-one": () => ({ status: 200, body: firstBoard }),
      "GET /backend-api/boards/board-two": () => ({ status: 200, body: secondBoard }),
      "POST /backend-api/boards": () => {
        boards = [...boards, { id: secondBoard.id, name: secondBoard.name }];
        return { status: 201, body: secondBoard };
      },
    });
    render(<Home />);

    await signIn(user);
    expect(await screen.findByRole("heading", { name: "First board" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /First board/ }));
    await user.click(screen.getByRole("button", { name: "New board" }));
    await user.type(screen.getByLabelText("Board name"), "Second board");
    await user.click(screen.getByRole("button", { name: "Create board" }));

    expect(await screen.findByRole("heading", { name: "Second board" })).toBeInTheDocument();
  });

  it("does not get stuck loading when clicking the already-active board in the switcher", async () => {
    const user = userEvent.setup();
    const board = makeApiBoard("board-one", "First board");
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: board.id, name: board.name }] }),
      "GET /backend-api/boards/board-one": () => ({ status: 200, body: board }),
    });
    render(<Home />);

    await signIn(user);
    expect(await screen.findByRole("heading", { name: "First board" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /First board/ }));
    const panel = screen.getByRole("button", { name: "New board" }).closest(".board-switcher-panel") as HTMLElement;
    await user.click(within(panel).getByRole("button", { name: "First board" }));

    expect(screen.queryByText("Loading your board...")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First board" })).toBeInTheDocument();
  });

  it("renames a board via the switcher", async () => {
    const user = userEvent.setup();
    let board = makeApiBoard("board-one", "First board");
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/boards": () => ({ status: 200, body: [{ id: board.id, name: board.name }] }),
      "GET /backend-api/boards/board-one": () => ({ status: 200, body: board }),
      "PATCH /backend-api/boards/board-one": (options) => {
        board = { ...board, ...JSON.parse(String(options?.body)) };
        return { status: 200, body: board };
      },
    });
    render(<Home />);

    await signIn(user);
    expect(await screen.findByRole("heading", { name: "First board" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /First board/ }));
    await user.click(screen.getByRole("button", { name: "Rename First board" }));
    await user.clear(screen.getByLabelText("Board name"));
    await user.type(screen.getByLabelText("Board name"), "Renamed board");
    await user.click(screen.getByRole("button", { name: "Rename board" }));

    expect(await screen.findByRole("heading", { name: "Renamed board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Renamed board/ })).toBeInTheDocument();
  });

  it("does not let a stale save from a previous board overwrite the newly active board", async () => {
    const user = userEvent.setup();
    const firstBoard = makeApiBoard("board-one", "First board");
    const secondBoard = makeApiBoard("board-two", "Second board");
    const boards = [
      { id: firstBoard.id, name: firstBoard.name },
      { id: secondBoard.id, name: secondBoard.name },
    ];
    const putGateControls: { resolve?: () => void } = {};
    const putGate = new Promise<void>((resolve) => {
      putGateControls.resolve = () => resolve();
    });
    stubFetch({
      "GET /backend-api/auth/me": () => ({ status: 401, body: { detail: "Not authenticated" } }),
      "POST /backend-api/auth/login": () => ({ status: 200, body: { id: "1", username: "user" } }),
      "GET /backend-api/boards": () => ({ status: 200, body: boards }),
      "GET /backend-api/boards/board-one": () => ({ status: 200, body: firstBoard }),
      "GET /backend-api/boards/board-two": () => ({ status: 200, body: secondBoard }),
    });
    render(<Home />);
    await signIn(user);
    expect(await screen.findByRole("heading", { name: "First board" })).toBeInTheDocument();

    // Replace the PUT handler with one that hangs until manually resolved, simulating a
    // save still in flight when the user switches to a different board.
    const originalFetch = global.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const key = `${options?.method ?? "GET"} ${pathOf(input)}`;
      if (key === "PUT /backend-api/boards/board-one") {
        await putGate;
        return { ok: true, status: 200, json: async () => firstBoard };
      }
      return originalFetch(input, options);
    }));

    await user.click(await screen.findByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByLabelText("Column name"));
    await user.type(screen.getByLabelText("Column name"), "Renamed while saving");
    await user.click(screen.getByRole("button", { name: "Rename column" }));

    await user.click(screen.getByRole("button", { name: /First board/ }));
    await user.click(screen.getByRole("button", { name: "Second board" }));
    expect(await screen.findByRole("heading", { name: "Second board" })).toBeInTheDocument();

    // Now let the stale save for board-one resolve; it must not clobber the now-active board.
    putGateControls.resolve?.();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Second board" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Renamed while saving" })).not.toBeInTheDocument();
  });
});
