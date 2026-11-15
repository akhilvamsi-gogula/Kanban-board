import { expect, Locator, Page, test } from "@playwright/test";

function uniqueUsername(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function signUp(page: Page, username: string, password: string) {
  await page.getByRole("button", { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible({ timeout: 15000 });
}

async function signIn(page: Page, username: string, password: string) {
  const usernameField = page.getByLabel("Username");
  const passwordField = page.getByLabel("Password", { exact: true });
  await usernameField.fill("");
  await passwordField.fill("");
  await usernameField.click();
  await usernameField.pressSequentially(username);
  await passwordField.click();
  await passwordField.pressSequentially(password);
  await expect(usernameField).toHaveValue(username);
  await expect(passwordField).toHaveValue(password);
  await page.getByRole("button", { name: "Open board" }).click();
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible({ timeout: 15000 });
}

// Board saves run one at a time; wait for the queue to drain like a user would before leaving.
async function waitForSaves(page: Page) {
  await expect(page.getByText("Saving...")).not.toBeVisible();
}

async function reloadAfterSaves(page: Page) {
  await waitForSaves(page);
  await page.reload();
}

async function addCard(page: Page, title: string) {
  await page.locator(".toolbar-add").click();
  await page.getByLabel("Title").fill(title);
  await page.locator(".dialog-form .button-primary").click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await waitForSaves(page);
}

function columnCardTitles(page: Page, columnIndex: number) {
  return page.locator("section.column").nth(columnIndex).locator(".task-card h3");
}

// Point inside an element; xFraction < 0.5 aims left of center, away from the right edge where
// dnd-kit starts auto-scrolling the horizontally scrolling board on a narrow phone screen.
async function pointIn(locator: Locator, xFraction = 0.5) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element is not visible");
  return { x: box.x + box.width * xFraction, y: box.y + box.height / 2 };
}

// Sends touch input through Chromium's real input pipeline (not synthetic JS events), so the
// browser's own scroll/gesture handling - where the original mobile bug lived - is exercised.
async function touchDrag(page: Page, from: Locator, to: Locator) {
  // The previous drag's drop animation keeps its floating card on screen for a moment.
  await expect(page.locator(".task-card-overlay")).toBeHidden();
  const start = await pointIn(from);
  const end = await pointIn(to, 0.2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  // The drag starts after a 150ms press-and-hold; wait until the card has actually lifted
  // (a busy machine can be slower than any fixed pause) before moving the finger.
  await expect(page.locator(".task-card-overlay")).toBeVisible();
  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    const point = { x: start.x + ((end.x - start.x) * step) / steps, y: start.y + ((end.y - start.y) * step) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    await page.waitForTimeout(16);
  }
  // On a narrow phone the target sits in the edge zone where the board auto-scrolls during a
  // drag, so it moves under the finger. Follow it, like a person would, until it holds still.
  let last = end;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(100);
    const current = await pointIn(to, 0.2);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [current] });
    if (Math.abs(current.x - last.x) < 1 && Math.abs(current.y - last.y) < 1) break;
    last = current;
  }
  await page.waitForTimeout(100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function mouseDrag(page: Page, from: Locator, to: Locator) {
  const start = await pointIn(from);
  const end = await pointIn(to, 0.2);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test("drags cards within and across columns", async ({ page, browserName }, testInfo) => {
  const isTouch = testInfo.project.use.hasTouch === true;
  test.skip(isTouch && browserName !== "chromium", "Real touch input is only scriptable in Chromium (via CDP); the pixel-7 and galaxy-s24-ultra projects cover touch drag.");
  const drag = isTouch ? touchDrag : mouseDrag;

  await page.goto("/");
  await signUp(page, uniqueUsername("drag"), "password123");
  await addCard(page, "Card A");
  await addCard(page, "Card B");
  await expect(columnCardTitles(page, 0)).toHaveText(["Card A", "Card B"]);

  // Within a column: drop Card B onto Card A's position.
  await drag(page, page.getByRole("button", { name: "Drag Card B", exact: true }), page.getByRole("heading", { name: "Card A" }));
  await expect(columnCardTitles(page, 0)).toHaveText(["Card B", "Card A"]);

  // Across columns: drop Card A into the empty second column.
  await drag(page, page.getByRole("button", { name: "Drag Card A", exact: true }), page.locator("section.column").nth(1).locator(".empty-column"));
  await expect(columnCardTitles(page, 0)).toHaveText(["Card B"]);
  await expect(columnCardTitles(page, 1)).toHaveText(["Card A"]);

  await reloadAfterSaves(page);
  await expect(columnCardTitles(page, 1)).toHaveText(["Card A"], { timeout: 15000 });
});

test("supports the core board workflow", async ({ page }) => {
  const username = uniqueUsername("workflow");
  const password = "password123";
  await page.goto("/");
  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();
  await expect(page.locator("section.column h2").first()).toBeVisible();

  await page.locator(".toolbar-add").click();
  await page.getByLabel("Title").fill("Browser workflow card");
  await page.getByLabel("Details").fill("Created in a real browser.");
  await page.locator(".dialog-form .button-primary").click();
  await expect(page.getByText("Browser workflow card")).toBeVisible();

  await page.locator("section.column").first().getByRole("button", { name: /^Rename / }).click();
  await page.getByLabel("Column name").fill("Ideas");
  await page.getByRole("button", { name: "Rename column" }).click();
  await expect(page.getByRole("heading", { name: "Ideas" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Browser workflow card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete this card?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete card" }).click();
  await expect(page.getByText("Browser workflow card")).not.toBeVisible();

  // Real sessions persist across reload (unlike the old demo-only auth), so no
  // re-sign-in is needed here - reload just confirms the rename survived a fresh fetch.
  await reloadAfterSaves(page);
  await expect(page.getByRole("heading", { name: "Ideas" })).toBeVisible({ timeout: 15000 });
});

test("supports creating, switching between, and isolating multiple boards", async ({ page }) => {
  const username = uniqueUsername("multiboard");
  const password = "password123";
  await page.goto("/");
  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();

  await page.locator(".toolbar-add").click();
  await page.getByLabel("Title").fill("Only on the first board");
  await page.locator(".dialog-form .button-primary").click();
  await expect(page.getByText("Only on the first board")).toBeVisible();

  await page.getByRole("button", { name: /My board/ }).click();
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Board name").fill("Second board");
  await page.getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { name: "Second board" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Only on the first board")).not.toBeVisible();

  await page.getByRole("button", { name: /Second board/ }).click();
  await page.getByRole("button", { name: "My board", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();
  await expect(page.getByText("Only on the first board")).toBeVisible();

  await reloadAfterSaves(page);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible({ timeout: 15000 });
});

test("supports renaming a board and re-selecting the active board without getting stuck loading", async ({ page }) => {
  const username = uniqueUsername("renameboard");
  const password = "password123";
  await page.goto("/");
  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();

  await page.getByRole("button", { name: /My board/ }).click();
  await page.getByRole("button", { name: "Rename My board" }).click();
  await page.getByLabel("Board name").fill("Renamed board");
  await page.getByRole("button", { name: "Rename board" }).click();
  await expect(page.getByRole("heading", { name: "Renamed board" })).toBeVisible({ timeout: 15000 });

  // Re-selecting the already-active board from the switcher must not get stuck loading.
  await page.getByRole("button", { name: /Renamed board/ }).click();
  await page.locator(".board-switcher-panel").getByRole("button", { name: "Renamed board", exact: true }).click();
  await expect(page.getByText("Loading your board...")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Renamed board" })).toBeVisible();

  await reloadAfterSaves(page);
  await expect(page.getByRole("heading", { name: "Renamed board" })).toBeVisible({ timeout: 15000 });
});

test("keeps the board usable on a narrow viewport", async ({ page }) => {
  const username = uniqueUsername("narrow");
  const password = "password123";
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/");
  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();
  await expect(page.locator(".board-grid")).toHaveCSS("overflow-x", "auto");
});

test("reaches every column and the AI composer on a phone screen", async ({ page }) => {
  // Galaxy S24 Ultra's CSS viewport; only about one column fits.
  await page.setViewportSize({ width: 384, height: 700 });
  await page.goto("/");
  await signUp(page, uniqueUsername("phone"), "password123");

  const done = page.locator("section.column").nth(4);
  await expect(done).not.toBeInViewport({ ratio: 0.9 });
  await page.getByRole("navigation", { name: "Jump to column" }).getByRole("button", { name: /Done/ }).click();
  await expect(done).toBeInViewport({ ratio: 0.9 });

  await page.getByRole("button", { name: "AI assistant" }).click();
  await expect(page.getByRole("textbox", { name: "Ask the board assistant" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Send" })).toBeInViewport();
});

// 980 is what a phone browser reports in "Desktop site" mode; 1024 is a tablet; 1200 is a
// narrow laptop window. Five columns need about 1270px, so at each of these the last column
// used to be cut off with no way to reach it (no chips, no sideways scrolling).
for (const width of [901, 980, 1024, 1200]) {
  test(`reaches the last column at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await signUp(page, uniqueUsername(`w${width}`), "password123");

    const done = page.locator("section.column").nth(4);
    await expect(done).not.toBeInViewport({ ratio: 0.9 });
    await page.getByRole("navigation", { name: "Jump to column" }).getByRole("button", { name: /Done/ }).click();
    await expect(done).toBeInViewport({ ratio: 0.9 });
  });
}

test("keeps maximum-length text inside its box on a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 832 });
  await page.goto("/");
  await signUp(page, uniqueUsername("long"), "password123");

  // Longest values the app allows, with no spaces to wrap at.
  await page.locator(".toolbar-add").click();
  await page.getByLabel("Title").fill("T".repeat(200));
  await page.getByLabel("Details").fill("https://example.com/" + "d".repeat(400));
  await page.locator(".dialog-form .button-primary").click();
  await page.getByRole("button", { name: "Rename Backlog" }).click();
  await page.getByLabel("Column name").fill("C".repeat(80));
  await page.locator(".dialog-form .button-primary").click();
  await page.locator(".board-switcher-trigger").click();
  await page.getByRole("button", { name: "Rename My board" }).click();
  await page.getByLabel("Board name").fill("B".repeat(120));
  await page.locator(".dialog-form .button-primary").click();
  await expect(page.getByRole("heading", { name: "B".repeat(120) })).toBeVisible();
  await waitForSaves(page);

  const spills = await page.evaluate(() => {
    const overflowing = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector)).some((element) => element.scrollWidth > element.clientWidth + 1);
    const chip = document.querySelector<HTMLElement>(".column-nav-chip")!.getBoundingClientRect();
    return {
      card: overflowing(".task-card"),
      boardTitle: overflowing(".board-toolbar h1"),
      chipPastScreen: chip.right > window.innerWidth,
      pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(spills).toEqual({ card: false, boardTitle: false, chipPastScreen: false, pageScrollsSideways: false });

  // The values survive a reload unchanged.
  await page.reload();
  await expect(page.getByRole("heading", { name: "T".repeat(200) })).toBeVisible({ timeout: 15000 });
});

test("hides the column chips on a desktop screen", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout only");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await signUp(page, uniqueUsername("wide"), "password123");
  await expect(page.getByRole("navigation", { name: "Jump to column" })).toBeHidden();
});

test("requires sign-in and supports logout", async ({ page }) => {
  const username = uniqueUsername("logout");
  const password = "password123";
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My board" })).not.toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("wrongpassword");
  await page.getByRole("button", { name: "Open board" }).click();
  await expect(page.locator(".auth-error")).toBeVisible();

  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();

  await signIn(page, username, password);
});
