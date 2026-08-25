import { expect, Page, test } from "@playwright/test";

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
  const passwordField = page.getByLabel("Password");
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
  await page.reload();
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

  await page.reload();
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

  await page.reload();
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

test("requires sign-in and supports logout", async ({ page }) => {
  const username = uniqueUsername("logout");
  const password = "password123";
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My board" })).not.toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Open board" }).click();
  await expect(page.locator(".auth-error")).toBeVisible();

  await signUp(page, username, password);
  await expect(page.getByRole("heading", { name: "My board" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();

  await signIn(page, username, password);
});
