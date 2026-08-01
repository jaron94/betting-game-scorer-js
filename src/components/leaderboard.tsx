"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOffline } from "@/components/offline-provider";
import type { LeaderboardRow } from "@/db/queries";
import {
  getLeaderboardSnapshot,
  saveLeaderboardSnapshot,
} from "@/lib/offline-storage";

interface LeaderboardResponse {
  configured: boolean;
  leaderboard: LeaderboardRow[];
  error?: string;
}

export function Leaderboard() {
  const { isOnline } = useOffline();
  const [view, setView] = useState<{
    data: LeaderboardResponse;
    source: "network" | "cache";
    savedAt?: string;
  } | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const networkLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getLeaderboardSnapshot<LeaderboardResponse>()
      .then((snapshot) => {
        if (!cancelled && snapshot && !networkLoaded.current) {
          setView({ data: snapshot.data, source: "cache", savedAt: snapshot.savedAt });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const payload = (await response.json()) as LeaderboardResponse;
      if (!response.ok) throw new Error(payload.error ?? "Could not load the leaderboard.");
      networkLoaded.current = true;
      setView({ data: payload, source: "network" });
      setRefreshError("");
      await saveLeaderboardSnapshot(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh the leaderboard.";
      setRefreshError(message);
      setView((current) => current ?? {
        data: { configured: true, leaderboard: [], error: message },
        source: "network",
      });
    }
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [isOnline, refresh]);

  if (!view) {
    return (
      <div className="leaderboard-card loading-card">
        {isOnline ? "Shuffling the standings…" : "No saved leaderboard is available offline yet."}
      </div>
    );
  }

  const { data } = view;
  if (data.error) return <div className="leaderboard-card empty-card"><strong>Leaderboard unavailable</strong><p>{data.error}</p></div>;
  if (!data.configured) return <div className="leaderboard-card empty-card"><strong>Database setup needed</strong><p>Add <code>DATABASE_URL</code> to start recording the rivalry.</p></div>;
  if (!data.leaderboard.length) return <div className="leaderboard-card empty-card"><strong>No results yet</strong><p>Publish the first finished game to claim the top spot.</p></div>;

  return (
    <>
      {view.source === "cache" ? (
        <div className="leaderboard-cache-note" role="status">
          <strong>Saved standings</strong>
          <span>
            {view.savedAt ? `Updated ${new Date(view.savedAt).toLocaleString()}. ` : ""}
            {isOnline ? refreshError || "Refreshing…" : "You’re offline, so these ratings may be out of date."}
          </span>
        </div>
      ) : null}
      <section className="leaderboard-card">
        <div className="leaderboard-head"><span>Rank & player</span><span>Rating</span><span>Record</span></div>
        <ol className="leaderboard-list">
          {data.leaderboard.map((player) => (
            <li key={player.id}>
              <div className="rank">{player.rank}</div>
              <div className="player-identity"><span className="avatar-letter">{player.name.charAt(0).toUpperCase()}</span><strong>{player.name}</strong></div>
              <div className="rating"><strong>{Math.round(player.rating)}</strong><small>Elo</small></div>
              <div className="record"><strong>{player.wins} wins</strong><small>{player.gamesPlayed} played · {Math.round(player.winRate * 100)}%</small></div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
