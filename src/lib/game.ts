export const DECK_SIZE = 52;
export const MAX_CARDS_PER_PLAYER = Math.floor(DECK_SIZE / 2);
export const MAX_PLAYERS = DECK_SIZE;
export const MIN_PLAYERS = 2;
export const STARTING_RATING = 1000;
export const TRUMP_SEQUENCE = ["spades", "hearts", "diamonds", "clubs", "none"] as const;

export type Trump = (typeof TRUMP_SEQUENCE)[number];
export type Stage = "bidding" | "results" | "complete";
export type ScoringMode = "tricks" | "difference" | "bid";
export type MissedBidScoring = "zero" | "negative";
export type TrumpMode = "cycle" | "manual";
export type TurnOrder = "dealer" | "next";
export type GamePreset = "betting-game" | "oh-hell" | "betting-alternative" | "custom";

export interface ScoringConfig {
  mode: ScoringMode;
  pointsPerUnit: number;
  exactBidBonus: number;
  missedBidScoring: MissedBidScoring;
}

export interface GameSettings {
  preset: GamePreset;
  startingCards: number;
  endingCards: number;
  scoring: ScoringConfig;
  trumpMode: TrumpMode;
  bidFirst: TurnOrder;
  leadFirst: TurnOrder;
  allowExactBidOnOneCard: boolean;
}

export const DEFAULT_SCORING: ScoringConfig = {
  mode: "tricks",
  pointsPerUnit: 1,
  exactBidBonus: 10,
  missedBidScoring: "zero",
};

export function maxCardsFor(playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Choose between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  }
  return Math.floor(DECK_SIZE / playerCount);
}

export function roundSequenceFor(
  playerCount: number,
  startingCards = Math.min(7, maxCardsFor(playerCount)),
  endingCards = startingCards,
): number[] {
  const maximum = maxCardsFor(playerCount);
  if (!Number.isInteger(startingCards) || startingCards < 1 || startingCards > maximum) {
    throw new Error(`Starting cards must be a whole number from 1 to ${maximum}.`);
  }
  if (!Number.isInteger(endingCards) || endingCards < 1 || endingCards > maximum) {
    throw new Error(`Ending cards must be a whole number from 1 to ${maximum}.`);
  }
  return [
    ...Array.from({ length: startingCards }, (_, index) => startingCards - index),
    ...Array.from({ length: endingCards - 1 }, (_, index) => index + 2),
  ];
}

export const CARD_SEQUENCE = roundSequenceFor(7);

export function settingsForPreset(
  preset: Exclude<GamePreset, "custom">,
  playerCount: number,
): GameSettings {
  const maximum = maxCardsFor(playerCount);
  const requestedStart = preset === "oh-hell" ? 10 : 7;
  const startingCards = Math.min(requestedStart, maximum);
  const alternative = preset === "betting-alternative";
  const ohHell = preset === "oh-hell";
  return {
    preset,
    startingCards,
    endingCards: ohHell ? 1 : startingCards,
    scoring: {
      mode: ohHell ? "bid" : alternative ? "difference" : "tricks",
      pointsPerUnit: 1,
      exactBidBonus: 10,
      missedBidScoring: "zero",
    },
    trumpMode: ohHell ? "manual" : "cycle",
    bidFirst: ohHell ? "next" : "dealer",
    leadFirst: "next",
    allowExactBidOnOneCard: true,
  };
}

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
  pendingTrump: Trump | null;
  settings: GameSettings;
  createdAt: string;
}

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

export function createGame(names: string[], settings?: GameSettings): GameState {
  const cleaned = names.map((name) => name.trim().replace(/\s+/g, " "));
  if (cleaned.length < MIN_PLAYERS || cleaned.length > MAX_PLAYERS) {
    throw new Error(`Choose between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  }
  if (cleaned.some((name) => !name)) throw new Error("Every player needs a name.");
  if (new Set(cleaned.map(normaliseName)).size !== cleaned.length) {
    throw new Error("Player names must be unique.");
  }
  const resolvedSettings = settings ?? settingsForPreset("betting-game", cleaned.length);
  validateGameSettings(resolvedSettings, cleaned.length);

  return {
    id: crypto.randomUUID(),
    players: cleaned.map((name) => ({ id: crypto.randomUUID(), name })),
    rounds: [],
    roundIndex: 0,
    stage: "bidding",
    pendingBids: {},
    pendingTrump: null,
    settings: { ...resolvedSettings, scoring: { ...resolvedSettings.scoring } },
    createdAt: new Date().toISOString(),
  };
}

type StoredGameState = Omit<GameState, "settings" | "pendingTrump"> & {
  settings?: Partial<Omit<GameSettings, "scoring">> & { scoring?: Partial<ScoringConfig> };
  scoring?: Partial<ScoringConfig>;
  pendingTrump?: Trump | null;
};

export function restoreGameState(value: unknown): GameState {
  const stored = value as StoredGameState;
  const fallback = settingsForPreset("betting-game", stored.players.length);
  const incoming = stored.settings;
  const settings: GameSettings = {
    ...fallback,
    ...incoming,
    preset: incoming?.preset ?? "custom",
    scoring: {
      ...DEFAULT_SCORING,
      ...stored.scoring,
      ...incoming?.scoring,
    },
  };
  validateGameSettings(settings, stored.players.length);
  return {
    ...stored,
    settings,
    pendingTrump: stored.pendingTrump ?? null,
  };
}

export function validateScoring(scoring: ScoringConfig): void {
  if (!Number.isInteger(scoring.pointsPerUnit) || scoring.pointsPerUnit < 0 || scoring.pointsPerUnit > 100) {
    throw new Error("The per-trick value must be a whole number from 0 to 100.");
  }
  if (!Number.isInteger(scoring.exactBidBonus) || scoring.exactBidBonus < 0 || scoring.exactBidBonus > 100) {
    throw new Error("The exact-bid value must be a whole number from 0 to 100.");
  }
  if (!["tricks", "difference", "bid"].includes(scoring.mode)) {
    throw new Error("Choose a valid scoring method.");
  }
  if (!["zero", "negative"].includes(scoring.missedBidScoring)) {
    throw new Error("Choose how missed bids are scored.");
  }
}

export function validateGameSettings(settings: GameSettings, playerCount: number): void {
  roundSequenceFor(playerCount, settings.startingCards, settings.endingCards);
  validateScoring(settings.scoring);
  if (!["betting-game", "oh-hell", "betting-alternative", "custom"].includes(settings.preset)) {
    throw new Error("Choose a valid rules preset.");
  }
  if (!["cycle", "manual"].includes(settings.trumpMode)) {
    throw new Error("Choose how trumps are determined.");
  }
  if (!["dealer", "next"].includes(settings.bidFirst) || !["dealer", "next"].includes(settings.leadFirst)) {
    throw new Error("Choose a valid order of play.");
  }
  if (typeof settings.allowExactBidOnOneCard !== "boolean") {
    throw new Error("Choose whether exact bids are allowed in one-card rounds.");
  }
}

export function currentRound(state: GameState) {
  const cardSequence = roundSequenceFor(
    state.players.length,
    state.settings.startingCards,
    state.settings.endingCards,
  );
  const roundNumber = state.roundIndex + 1;
  const dealerIndex = state.roundIndex % state.players.length;
  const dealer = state.players[dealerIndex];
  const bidOffset = dealerIndex + (state.settings.bidFirst === "next" ? 1 : 0);
  const leadOffset = dealerIndex + (state.settings.leadFirst === "next" ? 1 : 0);
  return {
    roundNumber,
    cards: cardSequence[state.roundIndex],
    trump: state.settings.trumpMode === "cycle"
      ? TRUMP_SEQUENCE[state.roundIndex % TRUMP_SEQUENCE.length]
      : state.pendingTrump,
    dealer,
    bidOrder: rotate(state.players, bidOffset),
    leadOrder: rotate(state.players, leadOffset),
  };
}

export function chooseTrump(state: GameState, trump: Trump): GameState {
  if (state.stage !== "bidding") throw new Error("Trumps can only be chosen before bidding.");
  if (state.settings.trumpMode !== "manual") throw new Error("This game uses the automatic trump cycle.");
  if (!TRUMP_SEQUENCE.includes(trump)) throw new Error("Choose a valid trump suit.");
  return { ...state, pendingTrump: trump };
}

export function rotate<T>(values: readonly T[], offset: number): T[] {
  const shift = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
}

export function validateBids(
  bids: Record<string, number>,
  playerIds: string[],
  cards: number,
  allowExactlyBid = false,
): void {
  const values = playerIds.map((id) => bids[id]);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > cards)) {
    throw new Error(`Every bid must be a whole number from 0 to ${cards}.`);
  }
  if (!allowExactlyBid && values.reduce((sum, value) => sum + value, 0) === cards) {
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
  const exact = bid === tricks;
  if (scoring.mode === "bid") {
    if (exact) return scoring.exactBidBonus + bid * scoring.pointsPerUnit;
    return scoring.missedBidScoring === "zero"
      ? 0
      : -Math.abs(tricks - bid) * scoring.pointsPerUnit;
  }
  const base = scoring.mode === "tricks"
    ? tricks * scoring.pointsPerUnit
    : (tricks - bid) * scoring.pointsPerUnit;
  return base + (exact ? scoring.exactBidBonus : 0);
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
  if (!round.trump) throw new Error("Choose trumps before locking in the bids.");
  const allowExactlyBid = round.cards === 1 && state.settings.allowExactBidOnOneCard;
  validateBids(bids, state.players.map(({ id }) => id), round.cards, allowExactlyBid);
  return { ...state, pendingBids: bids, stage: "results" };
}

export function submitTricks(state: GameState, tricks: Record<string, number>): GameState {
  if (state.stage !== "results") throw new Error("Record the bids first.");
  const round = currentRound(state);
  validateTricks(tricks, state.players.map(({ id }) => id), round.cards);
  const completedRound: RoundResult = {
    roundNumber: round.roundNumber,
    cards: round.cards,
    trump: round.trump!,
    dealerPlayerId: round.dealer.id,
    bids: state.pendingBids,
    tricks,
  };
  const rounds = [...state.rounds, completedRound];
  const complete = rounds.length === roundSequenceFor(
    state.players.length,
    state.settings.startingCards,
    state.settings.endingCards,
  ).length;
  return {
    ...state,
    rounds,
    roundIndex: complete ? state.roundIndex : state.roundIndex + 1,
    stage: complete ? "complete" : "bidding",
    pendingBids: {},
    pendingTrump: null,
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
    pendingTrump: previous.trump,
  };
}
