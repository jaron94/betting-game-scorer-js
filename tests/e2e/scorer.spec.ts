import { expect, test, type Page } from "@playwright/test";

async function setUpTwoPlayers(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s at the table?" })).toBeVisible();

  await page.getByRole("spinbutton", { name: "Number of players" }).fill("2");
  await expect(page.getByLabel("Player 3")).toHaveCount(0);
  await page.getByLabel("Player 1 · deals first").fill("Ada");
  await page.getByLabel("Player 2").fill("Ben");
}

async function openCustomRules(page: Page) {
  await page.locator("summary").filter({ hasText: "Customise rules" }).click();
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
  await openCustomRules(page);

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
  await openCustomRules(page);

  await page.getByLabel("Scoring method").selectOption("difference");
  await expect(page.getByLabel("Points per difference")).toHaveValue("1");
  await expect(
    page.getByRole("spinbutton", { name: "Exact-bid bonus", exact: true }),
  ).toHaveValue("10");

  await scoreFirstRound(page, { Ada: 4, Ben: 4 }, { Ada: 3, Ben: 4 });

  await expect(scoreFor(page, "Ada")).toHaveText("-1");
  await expect(scoreFor(page, "Ben")).toHaveText("10");
});

test("returns directly to setup and offers remembered players", async ({ page }) => {
  await setUpTwoPlayers(page);
  await page.getByRole("button", { name: "Deal the first round" }).click();

  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("alertdialog", { name: "Leave this game?" })).toBeVisible();
  await page.getByRole("button", { name: "Start a new game" }).click();

  await expect(page.getByRole("heading", { name: "Who’s at the table?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use last players" })).toBeVisible();
  await page.getByRole("button", { name: "Use last players" }).click();
  await expect(page.getByLabel("Player 1 · deals first")).toHaveValue("Ada");
  await expect(page.getByLabel("Player 2")).toHaveValue("Ben");
  await expect(page.getByRole("spinbutton", { name: "Number of players" })).toHaveValue("2");
  await page.reload();
  await expect(page.locator("#remembered-players option")).toHaveCount(2);
  await page.getByRole("button", { name: "Forget saved names" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Use last players" })).toHaveCount(0);
});

test("uses a shorter card sequence for eight players", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("spinbutton", { name: "Number of players" }).fill("8");

  await expect(page.getByText("11 rounds · 6 → 1 → 6")).toBeVisible();
  for (let index = 0; index < 8; index += 1) {
    const label = index === 0 ? "Player 1 · deals first" : `Player ${index + 1}`;
    await page.getByLabel(label).fill(`Player ${index + 1}`);
  }

  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByText("Round 1 of 11")).toBeVisible();
  await expect(page.getByText("6 cards ·")).toBeVisible();
});

test("configures Oh Hell, manual trumps, and simultaneous one-card bidding", async ({ page }) => {
  await setUpTwoPlayers(page);

  await page.getByLabel("Rules preset").selectOption("oh-hell");
  await openCustomRules(page);
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

test("updates result validation while tricks are edited", async ({ page }) => {
  await setUpTwoPlayers(page);
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await page.getByLabel("Ada bid").fill("2");
  await page.getByLabel("Ben bid").fill("2");
  await page.getByRole("button", { name: "Lock in bids" }).click();

  const scoreButton = page.getByRole("button", { name: "Score this round" });
  await expect(scoreButton).toBeDisabled();
  await expect(page.getByText("3 tricks left to assign.")).toBeVisible();

  await page.getByLabel("Ben tricks").fill("5");
  await expect(page.getByText("All 7 tricks are assigned.")).toBeVisible();
  await expect(scoreButton).toBeEnabled();
});

test("keeps entered names when count changes and summarises edited presets", async ({ page }) => {
  await setUpTwoPlayers(page);
  await expect(page.getByRole("button", { name: "Fewer players" })).toBeDisabled();
  await page.getByRole("button", { name: "More players" }).click();
  await page.getByLabel("Player 3").fill("Cara");
  await page.getByRole("button", { name: "Fewer players" }).click();
  await page.getByRole("button", { name: "More players" }).click();
  await expect(page.getByLabel("Player 3")).toHaveValue("Cara");
  await openCustomRules(page);
  await page.getByLabel("Ending cards").selectOption("1");
  await expect(page.getByLabel("Rules preset")).toHaveValue("custom");
  await expect(page.getByLabel("Rules preset").locator("option:checked")).toHaveText("Betting game (edited)");
  await expect(page.locator(".setup-rule-summary")).toContainText("7 rounds · 7 → 1");
  await page.getByText("Customise rules", { exact: true }).click();
  await expect(page.getByLabel("Ending cards")).toBeHidden();
  await expect(page.locator(".setup-rule-summary")).toContainText("7 rounds · 7 → 1");
  await page.getByLabel("Rules preset").selectOption("oh-hell");
  await expect(page.locator(".setup-rule-summary")).toContainText("10 rounds · 10 → 1");
  await expect(page.getByLabel("Starting cards")).toBeHidden();
});

test("name-memory storage failures do not prevent starting a game", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "betting-game-scorer-players-v1") throw new Error("Storage full");
      return original.call(this, key, value);
    };
  });
  await setUpTwoPlayers(page);
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();
});

test("reveals invalid custom settings even after the rules are collapsed", async ({ page }) => {
  await setUpTwoPlayers(page);
  await openCustomRules(page);
  const bonus = page.getByRole("spinbutton", { name: "Exact-bid bonus", exact: true });
  await bonus.fill("-1");
  await page.getByText("Customise rules", { exact: true }).click();
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.locator(".form-error")).toBeVisible();
  await expect(bonus).toBeVisible();
  await bonus.fill("10");
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();
});
