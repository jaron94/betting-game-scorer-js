"use client";

import { useEffect, useState } from "react";
import type { LeaderboardRow } from "@/db/queries";

interface LeaderboardResponse {
  configured: boolean;
  leaderboard: LeaderboardRow[];
  error?: string;
}

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as LeaderboardResponse;
        if (!response.ok) throw new Error(payload.error ?? "Could not load the leaderboard.");
        return payload;
      })
      .then(setData)
      .catch((error: Error) => setData({ configured: true, leaderboard: [], error: error.message }));
  }, []);

  if (!data) return <div className="leaderboard-card loading-card">Shuffling the standings…</div>;
  if (data.error) return <div className="leaderboard-card empty-card"><strong>Leaderboard unavailable</strong><p>{data.error}</p></div>;
  if (!data.configured) return <div className="leaderboard-card empty-card"><strong>Database setup needed</strong><p>Add <code>DATABASE_URL</code> to start recording the rivalry.</p></div>;
  if (!data.leaderboard.length) return <div className="leaderboard-card empty-card"><strong>No results yet</strong><p>Publish the first finished game to claim the top spot.</p></div>;

  return (
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
  );
}
