import { describe, expect, it } from "vitest";
import {
  CARD_SEQUENCE,
  createGame,
  currentRound,
  pointsFor,
  rollback,
  submitBids,
  submitTricks,
  totalsFor,
} from "@/lib/game";

describe("legacy Betting Game rules", () => {
  it("uses the original 7 down to 1 and back to 7 sequence", () => {
    expect(CARD_SEQUENCE).toEqual([7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("awards tricks plus ten points for matching the bid", () => {
    expect(pointsFor(3, 3)).toBe(13);
    expect(pointsFor(3, 4)).toBe(4);
    expect(pointsFor(0, 0)).toBe(10);
  });

  it("rejects an exactly-bid round", () => {
    const game = createGame(["Ada", "Ben", "Cam"]);
    const [ada, ben, cam] = game.players;
    expect(() => submitBids(game, { [ada.id]: 2, [ben.id]: 2, [cam.id]: 3 })).toThrow("cannot add up");
  });

  it("rejects results that do not use every trick", () => {
    let game = createGame(["Ada", "Ben"]);
    const [ada, ben] = game.players;
    game = submitBids(game, { [ada.id]: 2, [ben.id]: 2 });
    expect(() => submitTricks(game, { [ada.id]: 2, [ben.id]: 2 })).toThrow("add up to 7");
  });

  it("rotates the dealer and can roll back a completed round", () => {
    let game = createGame(["Ada", "Ben", "Cam"]);
    const [ada, ben, cam] = game.players;
    game = submitBids(game, { [ada.id]: 1, [ben.id]: 2, [cam.id]: 3 });
    game = submitTricks(game, { [ada.id]: 1, [ben.id]: 2, [cam.id]: 4 });
    expect(currentRound(game).dealer.name).toBe("Ben");
    expect(totalsFor(game.players, game.rounds)).toEqual({ [ada.id]: 11, [ben.id]: 12, [cam.id]: 4 });

    game = rollback(game);
    expect(game.stage).toBe("results");
    expect(game.roundIndex).toBe(0);
    expect(game.rounds).toHaveLength(0);
    expect(game.pendingBids).toEqual({ [ada.id]: 1, [ben.id]: 2, [cam.id]: 3 });
  });
});
