import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { gamePlayers, games, players, roundResults, rounds } from "@/db/schema";
import { calculateMultiplayerElo } from "@/lib/elo";
import { normaliseName, pointsFor, positionsFor, totalsFor } from "@/lib/game";
import type { CompletedGameInput } from "@/lib/validation";

export interface SavedRating {
  name: string;
  ratingBefore: number;
  ratingAfter: number;
  change: number;
}

export async function saveCompletedGame(game: CompletedGameInput): Promise<SavedRating[]> {
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.insert(games).values({
      id: game.id,
      playedAt: new Date(game.createdAt),
      scoringMode: game.settings.scoring.mode,
      pointsPerUnit: game.settings.scoring.pointsPerUnit,
      exactBidBonus: game.settings.scoring.exactBidBonus,
    });

    await tx
      .insert(players)
      .values(
        game.players.map((player) => ({
          displayName: player.name.trim().replace(/\s+/g, " "),
          normalisedName: normaliseName(player.name),
        })),
      )
      .onConflictDoNothing({ target: players.normalisedName });

    const playerRows = await tx
      .select()
      .from(players)
      .where(inArray(players.normalisedName, game.players.map(({ name }) => normaliseName(name))));

    if (playerRows.length !== game.players.length) throw new Error("Could not resolve every player.");

    const orderedIds = playerRows.map(({ id }) => id).sort();
    await tx.execute(
      sql`select ${players.id} from ${players} where ${inArray(players.id, orderedIds)} order by ${players.id} for update`,
    );

    const lockedPlayers = await tx.select().from(players).where(inArray(players.id, orderedIds));
    const dbByName = new Map(lockedPlayers.map((player) => [player.normalisedName, player]));
    const dbByLocalId = new Map(
      game.players.map((player) => [player.id, dbByName.get(normaliseName(player.name))!]),
    );

    const totals = totalsFor(game.players, game.rounds, game.settings.scoring);
    const positions = positionsFor(game.players, totals);
    const eloResults = calculateMultiplayerElo(
      game.players.map((player) => ({
        id: player.id,
        score: totals[player.id],
        rating: Number(dbByLocalId.get(player.id)!.rating),
      })),
    );
    const eloByLocalId = new Map(eloResults.map((result) => [result.id, result]));

    for (const player of game.players) {
      const dbPlayer = dbByLocalId.get(player.id)!;
      const result = eloByLocalId.get(player.id)!;
      const winner = positions[player.id] === 1;
      await tx.insert(gamePlayers).values({
        gameId: game.id,
        playerId: dbPlayer.id,
        finishingPosition: positions[player.id],
        finalScore: totals[player.id],
        ratingBefore: result.rating.toFixed(4),
        ratingAfter: result.newRating.toFixed(4),
        ratingChange: result.change.toFixed(4),
      });
      await tx
        .update(players)
        .set({
          displayName: player.name.trim().replace(/\s+/g, " "),
          rating: result.newRating.toFixed(4),
          gamesPlayed: sql`${players.gamesPlayed} + 1`,
          wins: winner ? sql`${players.wins} + 1` : players.wins,
          updatedAt: new Date(),
        })
        .where(and(eq(players.id, dbPlayer.id), eq(players.normalisedName, dbPlayer.normalisedName)));
    }

    const runningTotals = Object.fromEntries(game.players.map(({ id }) => [id, 0]));
    for (const round of game.rounds) {
      const [savedRound] = await tx
        .insert(rounds)
        .values({
          gameId: game.id,
          roundNumber: round.roundNumber,
          cards: round.cards,
          trump: round.trump,
          dealerPlayerId: dbByLocalId.get(round.dealerPlayerId)!.id,
        })
        .returning({ id: rounds.id });

      await tx.insert(roundResults).values(
        game.players.map((player) => {
          const points = pointsFor(round.bids[player.id], round.tricks[player.id], game.settings.scoring);
          runningTotals[player.id] += points;
          return {
            roundId: savedRound.id,
            playerId: dbByLocalId.get(player.id)!.id,
            bid: round.bids[player.id],
            tricks: round.tricks[player.id],
            points,
            totalScore: runningTotals[player.id],
          };
        }),
      );
    }

    return game.players.map((player) => {
      const result = eloByLocalId.get(player.id)!;
      return {
        name: player.name,
        ratingBefore: result.rating,
        ratingAfter: result.newRating,
        change: result.change,
      };
    });
  });
}
