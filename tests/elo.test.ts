import { describe, expect, it } from "vitest";
import { calculateMultiplayerElo } from "@/lib/elo";

describe("multiplayer Elo", () => {
  it("is zero-sum for equally rated players", () => {
    const results = calculateMultiplayerElo([
      { id: "a", rating: 1000, score: 80 },
      { id: "b", rating: 1000, score: 60 },
      { id: "c", rating: 1000, score: 40 },
    ]);
    expect(results.reduce((sum, result) => sum + result.change, 0)).toBeCloseTo(0, 10);
    expect(results.map(({ change }) => change)).toEqual([16, 0, -16]);
  });

  it("treats equal final scores as draws", () => {
    const results = calculateMultiplayerElo([
      { id: "a", rating: 1000, score: 70 },
      { id: "b", rating: 1000, score: 70 },
    ]);
    expect(results[0].change).toBe(0);
    expect(results[1].change).toBe(0);
  });

  it("rewards an upset more than an expected win", () => {
    const upset = calculateMultiplayerElo([
      { id: "a", rating: 800, score: 70 },
      { id: "b", rating: 1200, score: 60 },
    ]);
    expect(upset[0].change).toBeGreaterThan(28);
    expect(upset[1].change).toBeLessThan(-28);
  });
});
