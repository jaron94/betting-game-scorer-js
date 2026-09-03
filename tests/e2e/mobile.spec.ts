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
  await expect(page.getByText("Flexible rules · 2–10 players · Elo ranked")).toBeVisible();
  await expect(page.locator('input[type="range"]')).toHaveAttribute("max", "10");
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

test("keeps ten-player entry and its action inside the game workspace", async ({ page }, testInfo) => {
  await page.goto("/");
  const playerCount = page.locator('input[type="range"]');
  await playerCount.focus();
  await playerCount.press("End");

  await page.getByLabel("First dealer").fill("Player 1");
  for (let player = 2; player <= 10; player += 1) {
    await page.getByLabel(`Player ${player}`).fill(`Player ${player}`);
  }
  await page.getByRole("button", { name: "Deal the first round" }).click();

  await expect(page.locator(".playing-game-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock in bids" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Scores" })).toBeInViewport();
  await expect(page.locator(".play-layout > .standings-card")).toBeHidden();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollHeight <= window.innerHeight + 1
  ))).toBe(true);

  const playerList = page.locator(".stepper-list");
  await expect(playerList).toBeInViewport();
  const listMetrics = await playerList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(listMetrics.clientHeight).toBeLessThanOrEqual(listMetrics.scrollHeight);

  await page.getByRole("button", { name: "Scores" }).click();
  const scoresDialog = page.getByRole("dialog", { name: "Scores" });
  await expect(scoresDialog).toBeVisible();
  await expect(scoresDialog.getByText("Live table")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mobile-ten-player-scores.png"), fullPage: true });
  await page.getByRole("button", { name: "Close scores" }).click();
  await expect(page.getByRole("dialog", { name: "Scores" })).toHaveCount(0);
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
