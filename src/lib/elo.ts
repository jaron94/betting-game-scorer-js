export const ELO_K_FACTOR = 32;
export const ELO_SCALE = 400;

export interface EloEntrant {
  id: string;
  rating: number;
  score: number;
}

export interface EloResult extends EloEntrant {
  expected: number;
  actual: number;
  change: number;
  newRating: number;
}

function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / ELO_SCALE));
}

function actualScore(score: number, opponentScore: number): number {
  if (score > opponentScore) return 1;
  if (score < opponentScore) return 0;
  return 0.5;
}

export function calculateMultiplayerElo(entrants: EloEntrant[], kFactor = ELO_K_FACTOR): EloResult[] {
  if (entrants.length < 2) throw new Error("Elo requires at least two players.");

  return entrants.map((entrant) => {
    const opponents = entrants.filter(({ id }) => id !== entrant.id);
    const expected = opponents.reduce(
      (total, opponent) => total + expectedScore(entrant.rating, opponent.rating),
      0,
    ) / opponents.length;
    const actual = opponents.reduce(
      (total, opponent) => total + actualScore(entrant.score, opponent.score),
      0,
    ) / opponents.length;
    const change = kFactor * (actual - expected);
    return { ...entrant, expected, actual, change, newRating: entrant.rating + change };
  });
}
