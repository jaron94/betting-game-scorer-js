export const MAX_PLAYERS = 7;
export const MIN_PLAYERS = 2;
export const STARTING_RATING = 1000;
export const CARD_SEQUENCE = [7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7] as const;
export const TRUMP_SEQUENCE = ["spades", "hearts", "diamonds", "clubs", "none"] as const;

export type Trump = (typeof TRUMP_SEQUENCE)[number];
export type Stage = "bidding" | "results" | "complete";
export type ScoringMode = "tricks" | "difference";

export interface ScoringConfig {
  mode: ScoringMode;
  pointsPerUnit: number;
  exactBidBonus: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  mode: "tricks",
  pointsPerUnit: 1,
  exactBidBonus: 10,
};

export interface PlayerSetup {
  id: string;
  name: string;
}

export interface RoundResult {
  roundNumber: number;
  cards: number;
  trump: Trump;
  dealerPlayerId: string;
  bids: Record<string, number>;
  tricks: Record<string, number>;
}

export interface GameState {
  id: string;
  players: PlayerSetup[];
  rounds: RoundResult[];
  roundIndex: number;
  stage: Stage;
  pendingBids: Record<string, number>;
  scoring: ScoringConfig;
  createdAt: string;
}

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

export function createGame(names: string[], scoring: ScoringConfig = DEFAULT_SCORING): GameState {
  const cleaned = names.map((name) => name.trim().replace(/\s+/g, " "));
  if (cleaned.length < MIN_PLAYERS || cleaned.length > MAX_PLAYERS) {
    throw new Error(`Choose between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  }
  if (cleaned.some((name) => !name)) throw new Error("Every player needs a name.");
  if (new Set(cleaned.map(normaliseName)).size !== cleaned.length) {
    throw new Error("Player names must be unique.");
  }
  validateScoring(scoring);

  return {
    id: crypto.randomUUID(),
    players: cleaned.map((name) => ({ id: crypto.randomUUID(), name })),
    rounds: [],
    roundIndex: 0,
    stage: "bidding",
    pendingBids: {},
    scoring: { ...scoring },
    createdAt: new Date().toISOString(),
  };
}

export function validateScoring(scoring: ScoringConfig): void {
  if (!Number.isInteger(scoring.pointsPerUnit) || scoring.pointsPerUnit < 0 || scoring.pointsPerUnit > 100) {
    throw new Error("The per-trick value must be a whole number from 0 to 100.");
  }
  if (!Number.isInteger(scoring.exactBidBonus) || scoring.exactBidBonus < 0 || scoring.exactBidBonus > 100) {
    throw new Error("The exact-bid value must be a whole number from 0 to 100.");
  }
}

export function currentRound(state: GameState) {
  const roundNumber = state.roundIndex + 1;
  return {
    roundNumber,
    cards: CARD_SEQUENCE[state.roundIndex],
    trump: TRUMP_SEQUENCE[state.roundIndex % TRUMP_SEQUENCE.length],
    dealer: state.players[state.roundIndex % state.players.length],
    order: rotate(state.players, state.roundIndex),
  };
}

export function rotate<T>(values: readonly T[], offset: number): T[] {
  const shift = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}

export function validateBids(bids: Record<string, number>, playerIds: string[], cards: number): void {
  const values = playerIds.map((id) => bids[id]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > cards)) {
    throw new Error(`Every bid must be a whole number from 0 to ${cards}.`);
  }
  if (values.reduce((sum, value) => sum + value, 0) === cards) {
    throw new Error("The bids cannot add up to exactly the number of tricks available.");
  }
}

export function validateTricks(tricks: Record<string, number>, playerIds: string[], cards: number): void {
  const values = playerIds.map((id) => tricks[id]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > cards)) {
    throw new Error(`Every result must be a whole number from 0 to ${cards}.`);
  }
  if (values.reduce((sum, value) => sum + value, 0) !== cards) {
    throw new Error(`The results must add up to ${cards} tricks.`);
  }
}

export function pointsFor(
  bid: number,
  tricks: number,
  scoring: ScoringConfig = DEFAULT_SCORING,
): number {
  const base = scoring.mode === "tricks"
    ? tricks * scoring.pointsPerUnit
    : -Math.abs(bid - tricks) * scoring.pointsPerUnit;
  return base + (bid === tricks ? scoring.exactBidBonus : 0);
}

export function totalsFor(
  players: PlayerSetup[],
  rounds: RoundResult[],
  scoring: ScoringConfig = DEFAULT_SCORING,
): Record<string, number> {
  return Object.fromEntries(
    players.map((player) => [
      player.id,
      rounds.reduce(
        (total, round) => total + pointsFor(round.bids[player.id], round.tricks[player.id], scoring),
        0,
      ),
    ]),
  );
}

export function positionsFor(players: PlayerSetup[], totals: Record<string, number>): Record<string, number> {
  const sortedScores = [...new Set(players.map((player) => totals[player.id]))].sort((a, b) => b - a);
  return Object.fromEntries(players.map((player) => [player.id, sortedScores.indexOf(totals[player.id]) + 1]));
}

export function submitBids(state: GameState, bids: Record<string, number>): GameState {
  if (state.stage !== "bidding") throw new Error("This round is not accepting bids.");
  const round = currentRound(state);
  validateBids(bids, state.players.map(({ id }) => id), round.cards);
  return { ...state, pendingBids: bids, stage: "results" };
}

export function submitTricks(state: GameState, tricks: Record<string, number>): GameState {
  if (state.stage !== "results") throw new Error("Record the bids first.");
  const round = currentRound(state);
  validateTricks(tricks, state.players.map(({ id }) => id), round.cards);
  const completedRound: RoundResult = {
    roundNumber: round.roundNumber,
    cards: round.cards,
    trump: round.trump,
    dealerPlayerId: round.dealer.id,
    bids: state.pendingBids,
    tricks,
  };
  const rounds = [...state.rounds, completedRound];
  const complete = rounds.length === CARD_SEQUENCE.length;
  return {
    ...state,
    rounds,
    roundIndex: complete ? state.roundIndex : state.roundIndex + 1,
    stage: complete ? "complete" : "bidding",
    pendingBids: {},
  };
}

export function rollback(state: GameState): GameState {
  if (state.stage === "results") return { ...state, stage: "bidding", pendingBids: {} };
  if (state.rounds.length === 0) throw new Error("There is nothing to roll back yet.");
  const previous = state.rounds.at(-1)!;
  return {
    ...state,
    rounds: state.rounds.slice(0, -1),
    roundIndex: previous.roundNumber - 1,
    stage: "results",
    pendingBids: previous.bids,
  };
}
