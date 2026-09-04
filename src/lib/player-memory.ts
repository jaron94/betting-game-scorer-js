import { MAX_PLAYERS, MIN_PLAYERS, normaliseName } from "@/lib/game";

export const PLAYER_MEMORY_KEY = "betting-game-scorer-players-v1";
const MAX_REMEMBERED_NAMES = 40;

export interface PlayerMemory {
  names: string[];
  lastTable: string[];
}

function cleanNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<string>();
  return value.filter((name): name is string => typeof name === "string")
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => {
      const key = normaliseName(name);
      if (!name || name.length > 40 || found.has(key)) return false;
      found.add(key);
      return true;
    }).slice(0, MAX_REMEMBERED_NAMES);
}

export function parsePlayerMemory(value: unknown): PlayerMemory {
  const input = value && typeof value === "object" ? value as Partial<PlayerMemory> : {};
  const lastTable = cleanNames(input.lastTable);
  return {
    names: cleanNames(input.names),
    lastTable: lastTable.length >= MIN_PLAYERS && lastTable.length <= MAX_PLAYERS ? lastTable : [],
  };
}

export function rememberPlayers(previous: PlayerMemory, players: string[]): PlayerMemory {
  const lastTable = cleanNames(players);
  return parsePlayerMemory({ names: [...lastTable, ...previous.names], lastTable });
}
