import { expect, Page, test } from "@playwright/test";

async function signIn(page: Page) {
  const username = page.getByLabel("Username");
  const password = page.getByLabel("Password");
  await username.fill("");
  await password.fill("");
  await username.click();
  await username.pressSequentially("user");
  await password.click();
  await password.pressSequentially("password");
  await expect(username).toHaveValue("user");
  await expect(password).toHaveValue("password");
  await page.getByRole("button", { name: "Open board" }).click();
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible({ timeout: 15000 });
}

test("supports the core board workflow", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible();
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

  await page.reload();
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Ideas" })).toBeVisible();
});
test("keeps the board usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible();
  await expect(page.locator(".board-grid")).toHaveCSS("overflow-x", "auto");
});

test("requires sign-in and supports logout", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).not.toBeVisible();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Open board" }).click();
  await expect(page.locator(".auth-error")).toBeVisible();

  await signIn(page);
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to Kanban board" })).toBeVisible();
});
