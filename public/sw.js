const CACHE_NAME = "betting-game-scorer-shell-v1";
const APP_SHELL = [
  "/",
  "/leaderboard",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

function sameOriginAsset(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      && (url.pathname.startsWith("/_next/static/")
        || url.pathname === "/icon.svg"
        || url.pathname === "/icon-192.png"
        || url.pathname === "/icon-512.png"
        || url.pathname === "/manifest.webmanifest");
  } catch {
    return false;
  }
}

async function cachePageAndAssets(path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) throw new Error(`Could not cache ${path}.`);

  const cache = await caches.open(CACHE_NAME);
  await cache.put(path, response.clone());
  const html = await response.text();
  const assets = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1])
    .filter(sameOriginAsset);
  await Promise.allSettled(
    [...new Set(assets)].map(async (asset) => {
      const assetResponse = await fetch(asset, { cache: "reload" });
      if (assetResponse.ok) await cache.put(asset, assetResponse);
    }),
  );
}

async function warmAppShell() {
  await cachePageAndAssets("/");
  await Promise.allSettled(APP_SHELL.slice(1).map((path) => cachePageAndAssets(path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith("betting-game-scorer-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_APP_SHELL") event.waitUntil(warmAppShell());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const path = url.pathname === "/leaderboard" ? "/leaderboard" : "/";
            void cachePageAndAssets(path);
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(url.pathname))
            ?? (await cache.match("/"))
            ?? new Response("The scorer is not available offline yet. Open it once while online.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            });
        }),
    );
    return;
  }

  if (sameOriginAsset(request.url)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request))
          ?? new Response("", { status: 504, statusText: "Offline asset unavailable" })),
    );
  }
});
