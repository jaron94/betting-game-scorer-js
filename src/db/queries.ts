import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { players } from "@/db/schema";

export interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await getDb()
    .select({
      id: players.id,
      name: players.displayName,
      rating: players.rating,
      gamesPlayed: players.gamesPlayed,
      wins: players.wins,
    })
    .from(players)
    .orderBy(desc(players.rating), desc(players.wins), players.displayName);

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    rating: Number(row.rating),
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    winRate: row.gamesPlayed ? row.wins / row.gamesPlayed : 0,
  }));
}
