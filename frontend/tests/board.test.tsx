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

  it("stops typing at the same limits the backend enforces", async () => {
    // Without these a 201-character title was accepted on screen, then rejected by every save.
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    await user.click(document.querySelector(".toolbar-add") as HTMLButtonElement);
    const title = screen.getByLabelText("Title");
    await user.click(title);
    await user.paste("t".repeat(250));

    expect(title).toHaveValue("t".repeat(200));
    expect(screen.getByLabelText("Details")).toHaveAttribute("maxlength", "5000");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    expect(screen.getByLabelText("Column name")).toHaveAttribute("maxlength", "80");
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

  it("closes a dialog on Escape and returns focus to the button that opened it", async () => {
    const user = userEvent.setup();
    render(<Board isVisible onLogout={() => undefined} />);
    const renameButton = screen.getByRole("button", { name: "Rename Backlog" });
    await user.click(renameButton);
    expect(screen.getByLabelText("Column name")).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(renameButton).toHaveFocus();
  });

  it("puts the sortable attributes on the drag handle rather than the card", () => {
    render(<Board isVisible onLogout={() => undefined} />);
    const handle = screen.getByRole("button", { name: "Drag Map the user journey" });
    expect(handle).toHaveAttribute("aria-roledescription", "sortable");
    expect(handle.closest("article")).not.toHaveAttribute("tabindex");
  });

  describe("AI assistant", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("keeps the conversation when the panel is closed and reopened", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assistant_message: "You have 8 cards." }) }));
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await user.type(screen.getByLabelText("Ask the board assistant"), "how many cards?");
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect(await screen.findByText("You have 8 cards.")).toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: "Close AI assistant" })[1]);
      expect(screen.queryByText("You have 8 cards.")).not.toBeInTheDocument();
      await user.click(screen.getByLabelText("AI assistant"));
      expect(screen.getByText("You have 8 cards.")).toBeInTheDocument();
    });

    function routeFetch(handlers: Record<string, (init: RequestInit) => { ok: boolean; status?: number; body: unknown }>) {
      const calls: Array<{ url: string; init: RequestInit }> = [];
      const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const key = Object.keys(handlers).find((path) => url.endsWith(path));
        if (!key) throw new Error(`unexpected request ${url}`);
        const { ok, status = 200, body } = handlers[key](init);
        return { ok, status, json: async () => body };
      });
      vi.stubGlobal("fetch", fetchMock);
      return calls;
    }

    async function openAssistant(user: ReturnType<typeof userEvent.setup>) {
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
    }

    it("uploads an attachment, sends its text with the next message only, then clears it", async () => {
      const user = userEvent.setup();
      const calls = routeFetch({
        "/ai/attachments": () => ({ ok: true, body: { name: "spec.txt", text: "Build login", truncated: false } }),
        "/ai/chat": () => ({ ok: true, body: { assistant_message: "Here is what the spec asks for." } }),
      });
      await openAssistant(user);

      await user.upload(screen.getByTestId("attachment-input"), new File(["Build login"], "spec.txt", { type: "text/plain" }));
      const chips = await screen.findByRole("list", { name: "Attached files" });
      expect(await within(chips).findByText("1 KB")).toBeInTheDocument();
      expect(calls[0].init.body).toBeInstanceOf(FormData);
      expect(new Headers(calls[0].init.headers).has("Content-Type")).toBe(false);

      await user.type(screen.getByLabelText("Ask the board assistant"), "summarize this");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText("Here is what the spec asks for.")).toBeInTheDocument();
      const chatBody = JSON.parse(String(calls[1].init.body));
      expect(chatBody.attachments).toEqual([{ name: "spec.txt", text: "Build login", truncated: false }]);
      expect(chatBody.history.every((message: object) => Object.keys(message).sort().join() === "content,role")).toBe(true);
      expect(screen.queryByRole("list", { name: "Attached files" })).not.toBeInTheDocument();
      expect(screen.getByText(/spec\.txt/)).toBeInTheDocument();
    });

    it("sends only the file that is still attached after another was removed", async () => {
      // The first file is removed while it is still being read; its late result must not
      // come back as a chip or reach the chat request.
      const user = userEvent.setup();
      let finishDeck: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void = () => undefined;
      const calls: Array<{ url: string; init: RequestInit }> = [];
      vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/ai/chat")) return Promise.resolve({ ok: true, status: 200, json: async () => ({ assistant_message: "Read the notes." }) });
        const file = (init.body as FormData).get("file") as File;
        if (file.name === "deck.pptx") return new Promise((resolve) => { finishDeck = resolve; });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ name: "notes.txt", text: "Notes text", truncated: false }) });
      }));
      await openAssistant(user);

      await user.upload(screen.getByTestId("attachment-input"), new File(["PK"], "deck.pptx"));
      expect(await screen.findByText("Reading...")).toBeInTheDocument();
      expect(screen.getByText(/read with your next message only/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Remove deck.pptx" }));
      await user.upload(screen.getByTestId("attachment-input"), new File(["Notes text"], "notes.txt", { type: "text/plain" }));
      finishDeck({ ok: true, status: 200, json: async () => ({ name: "deck.pptx", text: "Slide text", truncated: false }) });
      const chips = await screen.findByRole("list", { name: "Attached files" });
      expect(await within(chips).findByText("1 KB")).toBeInTheDocument();
      expect(within(chips).queryByText("deck.pptx")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Ask the board assistant"), "make cards");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText("Read the notes.")).toBeInTheDocument();
      const chat = calls.find((call) => call.url.endsWith("/ai/chat"));
      expect(JSON.parse(String(chat?.init.body)).attachments).toEqual([{ name: "notes.txt", text: "Notes text", truncated: false }]);
    });

    it("shows why a file could not be read and leaves it out of the message", async () => {
      const user = userEvent.setup();
      const calls = routeFetch({
        "/ai/attachments": () => ({ ok: false, status: 422, body: { detail: "This PDF is password-protected." } }),
        "/ai/chat": () => ({ ok: true, body: { assistant_message: "Ok." } }),
      });
      await openAssistant(user);

      await user.upload(screen.getByTestId("attachment-input"), new File(["%PDF-"], "secret.pdf", { type: "application/pdf" }));
      expect(await screen.findByText("This PDF is password-protected.")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Ask the board assistant"), "hello");
      await user.click(screen.getByRole("button", { name: "Send" }));

      await screen.findByText("Ok.");
      expect(JSON.parse(String(calls[1].init.body)).attachments).toEqual([]);
    });

    it("rejects files over the size limit without uploading, and lets a chip be removed", async () => {
      const user = userEvent.setup();
      const calls = routeFetch({});
      await openAssistant(user);
      const big = new File(["x"], "huge.txt", { type: "text/plain" });
      Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 });

      await user.upload(screen.getByTestId("attachment-input"), big);

      expect(screen.getByText("Larger than 4 MB")).toBeInTheDocument();
      expect(calls).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "Remove huge.txt" }));
      expect(screen.queryByText("huge.txt")).not.toBeInTheDocument();
    });

    it("limits a message to three attachments", async () => {
      const user = userEvent.setup();
      routeFetch({ "/ai/attachments": () => ({ ok: true, body: { name: "a.txt", text: "a", truncated: false } }) });
      await openAssistant(user);
      const files = ["a", "b", "c", "d"].map((name) => new File([name], `${name}.txt`, { type: "text/plain" }));

      await user.upload(screen.getByTestId("attachment-input"), files);

      expect(screen.getByText("You can attach up to 3 files per message.")).toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "Attached files" })).getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByRole("button", { name: /Attach/ })).toBeDisabled();
    });

    it("shows the backend's busy message when Groq is rate limited", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: "AI is busy right now. Try again in 12 seconds." }),
      }));
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await user.type(screen.getByLabelText("Ask the board assistant"), "add a card");
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText("AI is busy right now. Try again in 12 seconds.")).toBeInTheDocument();
      expect(within(screen.getByRole("region", { name: "Backlog" })).getByText("Map the user journey")).toBeInTheDocument();
    });
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

  describe("AI guardrails", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // The seeded board as the API would return it, with the given Backlog card ids removed.
    function boardWithout(...removedIds: string[]) {
      return {
        name: "Q3 product launch",
        columns: initialColumns.map((column, index) => ({
          id: column.id,
          name: column.name,
          accent: column.accent,
          position: index,
          cards: column.cards.filter((card) => !removedIds.includes(card.id)).map((card, position) => ({ ...card, position })),
        })),
      };
    }

    function stubChat(body: object) {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    const removal = {
      assistant_message: 'Removed "Map the user journey".',
      board_update: boardWithout("map-user-journey"),
      changes: [{ kind: "card_removed", text: 'Removed "Map the user journey" from Backlog' }],
    };

    async function ask(user: ReturnType<typeof userEvent.setup>, prompt: string) {
      await user.type(screen.getByLabelText("Ask the board assistant"), prompt);
      await user.click(screen.getByRole("button", { name: "Send" }));
    }

    const backlog = () => within(screen.getByRole("region", { name: "Backlog" }));

    it("shows the change list from the server under a reply that changes the board", async () => {
      const user = userEvent.setup();
      stubChat({
        assistant_message: "Renamed the column.",
        board_update: { ...boardWithout(), columns: boardWithout().columns.map((column) => (column.id === "backlog" ? { ...column, name: "Ideas" } : column)) },
        changes: [{ kind: "column_renamed", text: 'Renamed column "Backlog" to "Ideas"' }],
      });
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await ask(user, "rename backlog to ideas");

      const list = await screen.findByRole("list", { name: "Changes made" });
      expect(within(list).getByText('Renamed column "Backlog" to "Ideas"')).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument();
    });

    it("holds a removal until Apply, shows its own text instead of the model's, and can undo it", async () => {
      const user = userEvent.setup();
      stubChat(removal);
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await ask(user, "remove the journey card");

      // Nothing has happened yet, so neither the message nor the list may say "Removed".
      expect(await screen.findByText("I can make the changes below. Nothing has changed yet.")).toBeInTheDocument();
      expect(screen.queryByText('Removed "Map the user journey".')).not.toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "Proposed changes" })).getByText('Remove "Map the user journey" from Backlog')).toBeInTheDocument();
      expect(backlog().getByText("Map the user journey")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Apply" }));

      // The same message now says it was applied, with the list in the past tense.
      expect(backlog().queryByText("Map the user journey")).not.toBeInTheDocument();
      expect(screen.getByText("Applied the changes below.")).toBeInTheDocument();
      expect(screen.queryByText(/Nothing has changed yet/)).not.toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "Changes made" })).getByText('Removed "Map the user journey" from Backlog')).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();

      await ask(user, "undo");
      expect(backlog().getByText("Map the user journey")).toBeInTheDocument();
    });

    it("leaves the board unchanged when a removal is discarded, and tells the model on the next turn", async () => {
      const user = userEvent.setup();
      const fetchMock = stubChat(removal);
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await ask(user, "remove the journey card");
      await user.click(await screen.findByRole("button", { name: "Discard" }));

      expect(backlog().getByText("Map the user journey")).toBeInTheDocument();
      expect(screen.getByText("Discarded the changes below. The board was not changed.")).toBeInTheDocument();
      expect(within(screen.getByRole("list", { name: "Not applied" })).getByText('Remove "Map the user journey" from Backlog')).toBeInTheDocument();

      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ assistant_message: "Understood." }) });
      await ask(user, "thanks");
      await screen.findByText("Understood.");
      const history = JSON.parse(fetchMock.mock.calls[1][1].body).history.map((entry: { content: string }) => entry.content);
      expect(history).toContain('Discarded the changes below. The board was not changed.\nNot applied:\n- Remove "Map the user journey" from Backlog');
    });

    it("refuses to apply a removal after the board was edited, so the edit is not overwritten", async () => {
      const user = userEvent.setup();
      stubChat(removal);
      render(<Board isVisible onLogout={() => undefined} />);
      await user.click(screen.getByLabelText("AI assistant"));
      await ask(user, "remove the journey card");
      await screen.findByRole("button", { name: "Apply" });

      // Edit the board by hand while the proposal waits.
      await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
      const columnInput = screen.getByLabelText("Column name");
      await user.clear(columnInput);
      await user.type(columnInput, "Ideas");
      await user.click(screen.getByRole("button", { name: "Rename column" }));

      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(screen.getByText("The board changed after this suggestion, so nothing was applied. Ask again for an up-to-date suggestion.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument();
      expect(within(screen.getByRole("region", { name: "Ideas" })).getByText("Map the user journey")).toBeInTheDocument();
    });
  });
});
