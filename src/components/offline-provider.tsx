"use client";

import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SavedRating } from "@/db/save-game";
import {
  queueCompletedGame,
  queuedGames,
  removeQueuedGame,
  type QueuedGame,
} from "@/lib/offline-storage";
import type { CompletedGameInput } from "@/lib/validation";

export const GAME_PUBLISHED_EVENT = "betting-game-scorer:game-published";

interface DeliveryResult {
  delivered: boolean;
  ratings: SavedRating[];
  error?: string;
  needsCode?: boolean;
}

export interface PublishOutcome {
  status: "published" | "queued";
  ratings: SavedRating[];
  error?: string;
}

interface OfflineContextValue {
  isOnline: boolean;
  pwaReady: boolean;
  pendingCount: number;
  syncing: boolean;
  needsCode: boolean;
  syncError: string;
  publishGame: (game: CompletedGameInput, code: string) => Promise<PublishOutcome>;
  syncPending: (code?: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

async function deliverGame(record: QueuedGame, code: string): Promise<DeliveryResult> {
  try {
    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json", "x-scorer-access-code": code },
      body: JSON.stringify(record.game),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      ratings?: SavedRating[];
    };

    if (response.ok || response.status === 409) {
      await removeQueuedGame(record.id);
      return { delivered: true, ratings: payload.ratings ?? [] };
    }

    return {
      delivered: false,
      ratings: [],
      error: payload.error ?? "The saved result could not be published yet.",
      needsCode: response.status === 401,
    };
  } catch {
    return {
      delivered: false,
      ratings: [],
      error: "No connection. The result is safely stored on this device.",
    };
  }
}

function announcePublished(id: string, ratings: SavedRating[]) {
  window.dispatchEvent(
    new CustomEvent(GAME_PUBLISHED_EVENT, { detail: { id, ratings } }),
  );
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pwaReady, setPwaReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [syncError, setSyncError] = useState("");
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount((await queuedGames()).length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncPending = useCallback(async (code = "") => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError("");
    setNeedsCode(false);

    try {
      const records = await queuedGames();
      for (const record of records) {
        const result = await deliverGame(record, code);
        if (!result.delivered) {
          setNeedsCode(Boolean(result.needsCode));
          setSyncError(result.error ?? "The saved result could not be published yet.");
          break;
        }
        announcePublished(record.id, result.ratings);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not read saved results.");
    } finally {
      await refreshPending();
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPending]);

  const publishGame = useCallback(async (game: CompletedGameInput, code: string) => {
    await queueCompletedGame(game);
    await refreshPending();

    if (!navigator.onLine) {
      return {
        status: "queued",
        ratings: [],
        error: "You’re offline. This result will publish when a connection returns.",
      } satisfies PublishOutcome;
    }

    const result = await deliverGame({ id: game.id, game, queuedAt: new Date().toISOString() }, code);
    await refreshPending();
    setNeedsCode(Boolean(result.needsCode));
    setSyncError(result.delivered ? "" : result.error ?? "The result is waiting to publish.");

    if (result.delivered) {
      announcePublished(game.id, result.ratings);
      return { status: "published", ratings: result.ratings } satisfies PublishOutcome;
    }

    return {
      status: "queued",
      ratings: [],
      error: result.error,
    } satisfies PublishOutcome;
  }, [refreshPending]);

  useEffect(() => {
    let cancelled = false;
    const becameOnline = () => {
      setIsOnline(true);
      void syncPending();
    };
    const becameOffline = () => setIsOnline(false);

    queueMicrotask(() => {
      if (cancelled) return;
      setIsOnline(navigator.onLine);
      void refreshPending();
      if (navigator.onLine) void syncPending();
    });
    window.addEventListener("online", becameOnline);
    window.addEventListener("offline", becameOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", becameOnline);
      window.removeEventListener("offline", becameOffline);
    };
  }, [refreshPending, syncPending]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !navigator.webdriver) return;

    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: "CACHE_APP_SHELL" });
        if (!cancelled) setPwaReady(true);
      })
      .catch(() => {
        if (!cancelled) setPwaReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pwaReady,
        pendingCount,
        syncing,
        needsCode,
        syncError,
        publishGame,
        syncPending,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) throw new Error("useOffline must be used inside OfflineProvider.");
  return context;
}

export function ConnectionStatus() {
  const { isOnline, pendingCount, pwaReady } = useOffline();
  const label = isOnline
    ? pendingCount > 0
      ? `${pendingCount} waiting`
      : "Online"
    : pendingCount > 0
      ? `Offline · ${pendingCount} waiting`
      : "Offline";

  return (
    <span
      className={`connection-status ${isOnline ? "online" : "offline"}`}
      data-testid="connection-status"
      data-online={isOnline}
      data-pwa-ready={pwaReady}
      role="status"
      title={isOnline ? "Connected to the leaderboard" : "Scores are being saved on this device"}
    >
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export function PendingSyncBanner() {
  const { isOnline, pendingCount, syncing, needsCode, syncError, syncPending } = useOffline();
  const [code, setCode] = useState("");

  if (pendingCount === 0) return null;

  return (
    <section className="pending-sync-banner" aria-live="polite">
      <div>
        <strong>{pendingCount} completed {pendingCount === 1 ? "game is" : "games are"} saved on this device.</strong>
        <span>
          {!isOnline
            ? "They’ll publish automatically when you reconnect."
            : syncing
              ? "Publishing to the leaderboard…"
              : syncError || "Ready to publish to the leaderboard."}
        </span>
      </div>
      {isOnline && !syncing ? (
        <div className="pending-sync-actions">
          {needsCode ? (
            <label>
              <span>Scorer access code</span>
              <input
                type="password"
                value={code}
                autoComplete="off"
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          ) : null}
          <button className="text-button" onClick={() => void syncPending(code)}>
            Publish {pendingCount === 1 ? "result" : "results"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function OfflineLink({ href, children, onClick, ...props }: ComponentProps<typeof Link>) {
  const { isOnline } = useOffline();

  function navigateOffline(event: MouseEvent<HTMLAnchorElement>) {
    if (!isOnline && typeof href === "string") {
      event.preventDefault();
      window.location.assign(href);
      return;
    }
    onClick?.(event);
  }

  return (
    <Link href={href} onClick={navigateOffline} {...props}>
      {children}
    </Link>
  );
}
