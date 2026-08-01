import { describe, expect, it } from "vitest";
import { createGame, roundSequenceFor, submitBids, submitTricks } from "@/lib/game";
import { completedGameSchema } from "@/lib/validation";

describe("completed game validation", () => {
  it("accepts the deck-aware sequence for an eight-player game", () => {
    let game = createGame(Array.from({ length: 8 }, (_, index) => `Player ${index + 1}`));

    for (const cards of roundSequenceFor(game.players.length)) {
      const bids = Object.fromEntries(game.players.map(({ id }) => [id, 0]));
      const tricks = Object.fromEntries(game.players.map(({ id }) => [id, 0]));
      tricks[game.players[0].id] = cards;
      game = submitBids(game, bids);
      game = submitTricks(game, tricks);
    }

    expect(game.stage).toBe("complete");
    expect(game.rounds).toHaveLength(11);
    expect(completedGameSchema.safeParse(game).success).toBe(true);
  });
});
