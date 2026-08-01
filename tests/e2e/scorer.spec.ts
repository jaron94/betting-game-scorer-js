import { expect, test, type Page } from "@playwright/test";

async function setUpTwoPlayers(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Keep your eyes on the cards." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Scoring rules" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Keep your eyes on the cards." })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Scoring rules" })).toHaveCount(0);

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

  await expect(page.getByLabel("Rules preset")).toHaveValue("betting-game");
  await expect(page.getByLabel("Scoring method")).toHaveValue("tricks");
  await expect(page.getByLabel("Points per trick")).toHaveValue("1");
  await expect(
    page.getByRole("spinbutton", { name: "Exact-bid bonus", exact: true }),
  ).toHaveValue("10");

  await scoreFirstRound(page, { Ada: 2, Ben: 2 }, { Ada: 2, Ben: 5 });

  await expect(scoreFor(page, "Ada")).toHaveText("12");
  await expect(scoreFor(page, "Ben")).toHaveText("5");
});

test("scores the signed difference between tricks and the bid", async ({ page }) => {
  await setUpTwoPlayers(page);

  await page.getByLabel("Scoring method").selectOption("difference");
  await expect(page.getByLabel("Points per difference")).toHaveValue("1");
  await expect(
    page.getByRole("spinbutton", { name: "Exact-bid bonus", exact: true }),
  ).toHaveValue("10");

  await scoreFirstRound(page, { Ada: 4, Ben: 4 }, { Ada: 3, Ben: 4 });

  await expect(scoreFor(page, "Ada")).toHaveText("-1");
  await expect(scoreFor(page, "Ben")).toHaveText("10");
});

test("restores the introduction when starting a new game", async ({ page }) => {
  await setUpTwoPlayers(page);
  await page.getByRole("button", { name: "Deal the first round" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New game" }).click();

  await expect(page.getByRole("heading", { name: "Keep your eyes on the cards." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who’s at the table?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Scoring rules" })).toBeVisible();
});

test("uses a shorter card sequence for eight players", async ({ page }) => {
  await page.goto("/");

  const playerCount = page.locator('input[type="range"]');
  await playerCount.focus();
  await playerCount.press("Home");
  for (let index = 0; index < 6; index += 1) await playerCount.press("ArrowRight");

  await expect(page.getByText("11 rounds · 6 → 1 → 6")).toBeVisible();
  for (let index = 0; index < 8; index += 1) {
    const label = index === 0 ? "First dealer" : `Player ${index + 1}`;
    await page.getByLabel(label).fill(`Player ${index + 1}`);
  }

  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByText("Round 1 of 11")).toBeVisible();
  await expect(page.getByText("6 cards ·")).toBeVisible();
});

test("configures Oh Hell, manual trumps, and simultaneous one-card bidding", async ({ page }) => {
  await setUpTwoPlayers(page);

  await page.getByLabel("Rules preset").selectOption("oh-hell");
  await expect(page.getByLabel("Starting cards")).toHaveValue("10");
  await expect(page.getByLabel("Ending cards")).toHaveValue("1");
  await expect(page.getByLabel("Scoring method")).toHaveValue("bid");
  await expect(page.getByLabel("Trumps")).toHaveValue("manual");
  await expect(page.getByLabel("Who bids first?")).toHaveValue("next");
  await expect(page.getByLabel("Who leads?")).toHaveValue("next");

  await page.getByLabel("Starting cards").selectOption("1");
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByText("Simultaneous bids")).toBeVisible();
  await expect(page.getByText("The total may equal one.")).toBeVisible();

  await page.getByLabel("Trumps for this round").selectOption("hearts");
  await page.getByLabel("Ada bid").fill("0");
  await page.getByLabel("Ben bid").fill("1");
  await page.getByRole("button", { name: "Lock in bids" }).click();

  await page.getByLabel("Ada tricks").fill("0");
  await page.getByLabel("Ben tricks").fill("1");
  await page.getByRole("button", { name: "Score this round" }).click();

  await expect(page.locator(".final-table li").filter({ hasText: "Ben" })).toContainText("11 pts");
  await expect(page.locator(".final-table li").filter({ hasText: "Ada" })).toContainText("10 pts");
});
