import { expect, test } from "@playwright/test";

test("supports the core board workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();

  await page.locator(".toolbar-add").click();
  await page.getByLabel("Title").fill("Browser workflow card");
  await page.getByLabel("Details").fill("Created in a real browser.");
    await page.locator(".dialog-form .button-primary").click();
  await expect(page.getByText("Browser workflow card")).toBeVisible();

  await page.getByRole("button", { name: "Rename Backlog" }).click();
  await page.getByLabel("Column name").fill("Ideas");
  await page.getByRole("button", { name: "Rename column" }).click();
  await expect(page.getByRole("heading", { name: "Ideas" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Browser workflow card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete this card?" })).toBeVisible();
  await page.getByRole("button", { name: "Delete card" }).click();
  await expect(page.getByText("Browser workflow card")).not.toBeVisible();
});

test("keeps the board usable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Q3 product launch" })).toBeVisible();
  await expect(page.locator(".board-grid")).toHaveCSS("overflow-x", "auto");
});
