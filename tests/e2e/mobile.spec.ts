import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
}

async function setUpMobileGame(page: Page) {
  await page.goto("/");
  const playerCount = page.locator('input[type="range"]');
  await playerCount.focus();
  await playerCount.press("Home");
  await page.getByLabel("First dealer").fill("Ada");
  await page.getByLabel("Player 2").fill("Ben");
}

test("keeps setup concise and moves focus to the game", async ({ page }, testInfo) => {
  await setUpMobileGame(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByLabel("Rules preset")).toBeVisible();
  await expect(page.getByLabel("Scoring method")).toBeHidden();
  await expect(page.locator("summary").filter({ hasText: "Customise rules" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-setup.png"), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("mobile-game.png"), fullPage: true });

  const increaseButton = page.getByRole("button", { name: "Increase Ada" });
  const box = await increaseButton.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(42);
  expect(box?.width).toBeGreaterThanOrEqual(42);
});

test("shows live validation and an in-app reset dialog", async ({ page }, testInfo) => {
  await setUpMobileGame(page);
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await page.getByLabel("Ada bid").fill("2");
  await page.getByLabel("Ben bid").fill("2");
  await page.getByRole("button", { name: "Lock in bids" }).click();

  await expect(page.getByRole("button", { name: "Score this round" })).toBeDisabled();
  await expect(page.getByText("3 tricks left to assign.")).toBeVisible();
  await page.getByLabel("Ben tricks").fill("5");
  await expect(page.getByRole("button", { name: "Score this round" })).toBeEnabled();

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("alertdialog", { name: "Leave this game?" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("mobile-reset-dialog.png"), fullPage: true });
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("offers a scoring action from an empty leaderboard", async ({ page }, testInfo) => {
  await page.route("**/api/leaderboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: true, leaderboard: [] }),
    });
  });

  await page.goto("/leaderboard");
  await expect(page.locator(".empty-action")).toHaveAccessibleName("Score a game →");
  await expect(page.locator(".empty-action")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("mobile-leaderboard.png"), fullPage: true });
});
