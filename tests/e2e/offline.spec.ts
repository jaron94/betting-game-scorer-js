import { expect, test, type Page } from "@playwright/test";

async function waitForOfflineShell(page: Page) {
  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-pwa-ready", "true");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function setUpOneRoundGame(page: Page) {
  await page.goto("/");
  const playerCount = page.locator('input[type="range"]');
  await playerCount.focus();
  await playerCount.press("Home");
  await page.getByLabel("Starting cards").selectOption("1");
  await page.getByLabel("Ending cards").selectOption("1");
  await page.getByLabel("First dealer").fill("Ada");
  await page.getByLabel("Player 2").fill("Ben");
  await page.getByRole("button", { name: "Deal the first round" }).click();
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();
}

test("exposes an installable app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    name: "Betting Game Scorer",
    start_url: "/",
    display: "standalone",
    icons: expect.arrayContaining([
      expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icon-512.png", sizes: "512x512" }),
    ]),
  });
});

test("reloads and scores offline, then publishes the queued result on reconnect", async ({
  context,
  page,
}) => {
  await page.route("**/api/games", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ratings: [
          { name: "Ada", ratingBefore: 1000, ratingAfter: 984, change: -16 },
          { name: "Ben", ratingBefore: 1000, ratingAfter: 1016, change: 16 },
        ],
      }),
    });
  });

  await setUpOneRoundGame(page);
  await waitForOfflineShell(page);
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem("betting-game-scorer-active-game-v1") !== null
  ))).toBe(true);
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-online", "false");
  await expect(page.getByRole("heading", { name: "Place the bids" })).toBeVisible();
  await page.getByLabel("Ada bid").fill("0");
  await page.getByLabel("Ben bid").fill("1");
  await page.getByRole("button", { name: "Lock in bids" }).click();
  await page.getByLabel("Ada tricks").fill("0");
  await page.getByLabel("Ben tricks").fill("1");
  await page.getByRole("button", { name: "Score this round" }).click();
  await page.getByRole("button", { name: "Publish result" }).click();

  await expect(page.getByText("Saved on this device", { exact: true })).toBeVisible();
  await expect(page.getByText("1 completed game is saved on this device.")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Published to the leaderboard")).toBeVisible();
  await expect(page.getByText("1 completed game is saved on this device.")).toHaveCount(0);
  await expect(page.locator(".final-table li").filter({ hasText: "Ben" })).toContainText("+16.0 Elo");
});

test("shows the last downloaded leaderboard while offline", async ({ context, page }) => {
  await page.route("**/api/leaderboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        leaderboard: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            rank: 1,
            name: "Ada",
            rating: 1032,
            gamesPlayed: 2,
            wins: 2,
            winRate: 1,
          },
        ],
      }),
    });
  });

  await page.goto("/leaderboard");
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await waitForOfflineShell(page);
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("betting-game-scorer-offline", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const found = await new Promise<boolean>((resolve, reject) => {
      const request = database.transaction("snapshots", "readonly").objectStore("snapshots").get("leaderboard");
      request.onsuccess = () => resolve(Boolean(request.result));
      request.onerror = () => reject(request.error);
    });
    database.close();
    return found;
  })).toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved standings")).toBeVisible();
  await expect(page.getByText(/You’re offline, so these ratings may be out of date/)).toBeVisible();
});
