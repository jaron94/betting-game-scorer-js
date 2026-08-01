import { describe, expect, it } from "vitest";
import {
  CARD_SEQUENCE,
  DEFAULT_SCORING,
  chooseTrump,
  createGame,
  currentRound,
  pointsFor,
  restoreGameState,
  rollback,
  roundSequenceFor,
  settingsForPreset,
  submitBids,
  submitTricks,
  totalsFor,
} from "@/lib/game";

describe("legacy Betting Game rules", () => {
  it("uses the original 7 down to 1 and back to 7 sequence", () => {
    expect(CARD_SEQUENCE).toEqual([7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7]);
    expect(roundSequenceFor(2)).toEqual(CARD_SEQUENCE);
    expect(roundSequenceFor(7)).toEqual(CARD_SEQUENCE);
  });

  it("reduces the number of cards and rounds for larger tables", () => {
    expect(roundSequenceFor(8)).toEqual([6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6]);
    expect(roundSequenceFor(10)).toEqual([5, 4, 3, 2, 1, 2, 3, 4, 5]);
    expect(roundSequenceFor(52)).toEqual([1]);
  });

  it("supports independently configured starting and ending cards", () => {
    expect(roundSequenceFor(4, 10, 1)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(roundSequenceFor(4, 3, 5)).toEqual([3, 2, 1, 2, 3, 4, 5]);
  });

  it("awards tricks plus ten points for matching the bid", () => {
    expect(pointsFor(3, 3)).toBe(13);
    expect(pointsFor(3, 4)).toBe(4);
    expect(pointsFor(0, 0)).toBe(10);
  });

  it("uses the core scoring configuration by default", () => {
    const game = createGame(["Ada", "Ben"]);
    expect(game.settings.scoring).toEqual(DEFAULT_SCORING);
    expect(game.settings.preset).toBe("betting-game");
  });

  it("upgrades a legacy saved game without losing its scoring rules", () => {
    const game = createGame(["Ada", "Ben"]);
    const legacy = Object.fromEntries(
      Object.entries(game).filter(([key]) => key !== "settings" && key !== "pendingTrump"),
    );
    const restored = restoreGameState({
      ...legacy,
      scoring: { mode: "difference", pointsPerUnit: 2, exactBidBonus: 5 },
    });
    expect(restored.settings.preset).toBe("custom");
    expect(restored.settings.scoring).toEqual({
      mode: "difference",
      pointsPerUnit: 2,
      exactBidBonus: 5,
      missedBidScoring: "zero",
    });
  });

  it("supports configurable trick points and exact-bid bonuses", () => {
    const scoring = { mode: "tricks" as const, pointsPerUnit: 2, exactBidBonus: 5, missedBidScoring: "zero" as const };
    expect(pointsFor(3, 3, scoring)).toBe(11);
    expect(pointsFor(3, 4, scoring)).toBe(8);
  });

  it("supports scoring by the distance from the bid", () => {
    const scoring = { mode: "difference" as const, pointsPerUnit: 2, exactBidBonus: 10, missedBidScoring: "zero" as const };
    expect(pointsFor(3, 3, scoring)).toBe(10);
    expect(pointsFor(3, 5, scoring)).toBe(4);
    expect(pointsFor(3, 2, scoring)).toBe(-2);
  });

  it("scores one overtrick as one point in difference mode", () => {
    expect(pointsFor(2, 3, { mode: "difference", pointsPerUnit: 1, exactBidBonus: 10, missedBidScoring: "zero" })).toBe(1);
  });

  it("supports zero or negative scores for a missed Oh Hell bid", () => {
    const zeroMiss = { mode: "bid" as const, pointsPerUnit: 1, exactBidBonus: 10, missedBidScoring: "zero" as const };
    const negativeMiss = { ...zeroMiss, missedBidScoring: "negative" as const };
    expect(pointsFor(2, 2, zeroMiss)).toBe(12);
    expect(pointsFor(2, 3, zeroMiss)).toBe(0);
    expect(pointsFor(2, 3, negativeMiss)).toBe(-1);
    expect(pointsFor(3, 1, negativeMiss)).toBe(-2);
  });

  it("applies preset trump and order-of-play rules", () => {
    const betting = createGame(["Ada", "Ben", "Cam"]);
    expect(currentRound(betting).bidOrder[0].name).toBe("Ada");
    expect(currentRound(betting).leadOrder[0].name).toBe("Ben");
    expect(currentRound(betting).trump).toBe("spades");

    const ohHell = createGame(["Ada", "Ben", "Cam"], settingsForPreset("oh-hell", 3));
    expect(currentRound(ohHell).bidOrder[0].name).toBe("Ben");
    expect(currentRound(ohHell).leadOrder[0].name).toBe("Ben");
    expect(currentRound(ohHell).trump).toBeNull();
  });

  it("requires manual trumps and permits exactly bid on a one-card round", () => {
    const settings = { ...settingsForPreset("oh-hell", 2), startingCards: 1, endingCards: 1 };
    let game = createGame(["Ada", "Ben"], settings);
    const [ada, ben] = game.players;
    expect(() => submitBids(game, { [ada.id]: 0, [ben.id]: 1 })).toThrow("Choose trumps");

    game = chooseTrump(game, "hearts");
    game = submitBids(game, { [ada.id]: 0, [ben.id]: 1 });
    game = submitTricks(game, { [ada.id]: 0, [ben.id]: 1 });
    expect(game.stage).toBe("complete");
    expect(game.rounds[0].trump).toBe("hearts");
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
