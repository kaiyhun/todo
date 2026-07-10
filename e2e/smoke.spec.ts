import { test, expect } from "@playwright/test";

/**
 * Critical-path smoke tests. Deliberately avoids drag-and-drop (flaky in E2E) —
 * the board's move logic is covered by the pure unit-style functions in
 * `lib/board-state.ts`. These assert the app boots, navigates, and that the core
 * create + read paths work end to end against a real server + database.
 */

test("app shell renders and navigation works", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Welcome back",
  );

  // `exact: true` matters here — "Board" is a substring of "Dashboard".
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page).toHaveURL(/\/board/);
  await expect(page.getByRole("button", { name: "New epic" })).toBeVisible();

  await page.getByRole("link", { name: "Wiki", exact: true }).click();
  // /wiki server-redirects to /wiki/<slug>; wait for that to land before the next
  // click, or the in-flight redirect races (and wins) against it.
  await expect(page).toHaveURL(/\/wiki\/.+/);

  await page.getByRole("link", { name: "Members", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("a task can be created on the board and then deleted", async ({ page }) => {
  const title = `E2E smoke ${Date.now()}`;

  await page.goto("/board");

  // Open the first row's inline "Add task", type a title, submit with Enter.
  await page.getByRole("button", { name: "Add task" }).first().click();
  const input = page.getByRole("textbox", { name: "New task title" });
  await input.fill(title);
  await input.press("Enter");

  const card = page.getByText(title);
  await expect(card).toBeVisible();

  // Clean up so re-runs stay tidy: open the card, delete it, confirm it's gone.
  await card.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("the wiki renders a page", async ({ page }) => {
  await page.goto("/wiki");
  // The index redirects to the first page.
  await expect(page).toHaveURL(/\/wiki\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
