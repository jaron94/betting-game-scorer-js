import { describe, expect, it } from "vitest";
import { parsePlayerMemory, rememberPlayers } from "@/lib/player-memory";

describe("remembered player names", () => {
  it("handles missing and malformed storage", () => {
    expect(parsePlayerMemory(null)).toEqual({ names: [], lastTable: [] });
    expect(parsePlayerMemory({ names: "Ada", lastTable: [null] })).toEqual({ names: [], lastTable: [] });
  });

  it("normalises whitespace and deduplicates using the leaderboard identity rules", () => {
    expect(parsePlayerMemory({ names: [" Ada ", "ADA", "Ben   Smith", 3, "", "x".repeat(41)] }).names)
      .toEqual(["Ada", "Ben Smith"]);
  });

  it("keeps the last table in dealing order and earlier names as suggestions", () => {
    const previous = { names: ["Cara", "Ada"], lastTable: ["Cara", "Ada"] };
    expect(rememberPlayers(previous, ["Ben", "Ada"])).toEqual({ names: ["Ben", "Ada", "Cara"], lastTable: ["Ben", "Ada"] });
  });

  it("bounds stored suggestions and rejects oversized tables", () => {
    const names = Array.from({ length: 100 }, (_, index) => `Player ${index}`);
    expect(parsePlayerMemory({ names, lastTable: names }).names).toHaveLength(40);
    expect(parsePlayerMemory({ names, lastTable: names }).lastTable).toEqual([]);
  });
});
