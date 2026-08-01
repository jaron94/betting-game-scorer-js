import { expect, test, type Page } from "@playwright/test";

async function setUpTwoPlayers(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s at the table?" })).toBeVisible();

  const playerCount = page.locator('input[type="range"]');
  await playerCount.focus();
  await playerCount.press("Home");
  await expect(page.getByLabel("Player 3")).toHaveCount(0);
  await page.getByLabel("First dealer").fill("Ada");
  await page.getByLabel("Player 2").fill("Ben");
}

async function scoreFirstRound(
  page: Page,
  bids: { Ada: number; Ben: number },
  tricks: { Ada: number; Ben: number },
) {
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();

  await page.getByLabel("Ada bid").fill(String(bids.Ada));
  await page.getByLabel("Ben bid").fill(String(bids.Ben));
  await page.getByRole("button", { name: "Lock in bids" }).click();

  await expect(page.getByRole("heading", { name: "Record the results" })).toBeVisible();
  await page.getByLabel("Ada tricks").fill(String(tricks.Ada));
  await page.getByLabel("Ben tricks").fill(String(tricks.Ben));
  await page.getByRole("button", { name: "Score this round" }).click();

  await expect(page.getByText("Round 2 of 13")).toBeVisible();
}

function scoreFor(page: Page, player: string) {
  return page.locator(".standings-card li").filter({ hasText: player }).locator(".score");
}

test("uses the core scoring configuration by default", async ({ page }) => {
  await setUpTwoPlayers(page);

  await expect(page.getByLabel("Scoring method")).toHaveValue("tricks");
  await expect(page.getByLabel("Points per trick")).toHaveValue("1");
  await expect(page.getByLabel("Exact-bid bonus")).toHaveValue("10");

  await scoreFirstRound(page, { Ada: 2, Ben: 2 }, { Ada: 2, Ben: 5 });

  await expect(scoreFor(page, "Ada")).toHaveText("12");
  await expect(scoreFor(page, "Ben")).toHaveText("5");
});

test("scores the signed difference between tricks and the bid", async ({ page }) => {
  await setUpTwoPlayers(page);

  await page.getByLabel("Scoring method").selectOption("difference");
  await expect(page.getByLabel("Points per trick difference")).toHaveValue("1");
  await expect(page.getByLabel("Points for exact bid")).toHaveValue("10");

  await scoreFirstRound(page, { Ada: 4, Ben: 4 }, { Ada: 3, Ben: 4 });

  await expect(scoreFor(page, "Ada")).toHaveText("-1");
  await expect(scoreFor(page, "Ben")).toHaveText("10");
});
