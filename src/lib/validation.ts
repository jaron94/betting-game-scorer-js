import { z } from "zod";
import {
  DEFAULT_SCORING,
  MAX_CARDS_PER_PLAYER,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TRUMP_SEQUENCE,
  maxCardsFor,
  roundSequenceFor,
  settingsForPreset,
} from "@/lib/game";

const valueMap = z.record(z.string().uuid(), z.number().int().min(0).max(MAX_CARDS_PER_PLAYER));
const scoringSchema = z.object({
  mode: z.enum(["tricks", "difference", "bid"]),
  pointsPerUnit: z.number().int().min(0).max(100),
  exactBidBonus: z.number().int().min(0).max(100),
  missedBidScoring: z.enum(["zero", "negative"]),
});
const settingsSchema = z.object({
  preset: z.enum(["betting-game", "oh-hell", "betting-alternative", "custom"]),
  startingCards: z.number().int().min(1).max(MAX_CARDS_PER_PLAYER),
  endingCards: z.number().int().min(1).max(MAX_CARDS_PER_PLAYER),
  scoring: scoringSchema,
  trumpMode: z.enum(["cycle", "manual"]),
  bidFirst: z.enum(["dealer", "next"]),
  leadFirst: z.enum(["dealer", "next"]),
  allowExactBidOnOneCard: z.boolean(),
});

const completedGameBaseSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    settings: settingsSchema,
    players: z
      .array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(40) }))
      .min(MIN_PLAYERS)
      .max(MAX_PLAYERS),
    rounds: z.array(
      z.object({
        roundNumber: z.number().int().min(1).max(MAX_CARDS_PER_PLAYER * 2 - 1),
        cards: z.number().int().min(1).max(MAX_CARDS_PER_PLAYER),
        trump: z.enum(TRUMP_SEQUENCE),
        dealerPlayerId: z.string().uuid(),
        bids: valueMap,
        tricks: valueMap,
      }),
    ),
  })
  .superRefine((game, ctx) => {
    if (game.players.length < MIN_PLAYERS || game.players.length > MAX_PLAYERS) return;
    const maximum = maxCardsFor(game.players.length);
    if (game.settings.startingCards > maximum || game.settings.endingCards > maximum) {
      ctx.addIssue({ code: "custom", message: `Card counts cannot exceed ${maximum} for this number of players.` });
      return;
    }
    const cardSequence = roundSequenceFor(
      game.players.length,
      game.settings.startingCards,
      game.settings.endingCards,
    );
    if (game.rounds.length !== cardSequence.length) {
      ctx.addIssue({ code: "custom", message: `A completed game must contain ${cardSequence.length} rounds.` });
      return;
    }
    const ids = game.players.map(({ id }) => id);
    const normalised = game.players.map(({ name }) => name.trim().replace(/\s+/g, " ").toLowerCase());
    if (new Set(normalised).size !== normalised.length) {
      ctx.addIssue({ code: "custom", message: "Player names must be unique." });
    }
    game.rounds.forEach((round, index) => {
      if (round.roundNumber !== index + 1 || round.cards !== cardSequence[index]) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} does not match the required card sequence.` });
      }
      if (!ids.includes(round.dealerPlayerId)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has an unknown dealer.` });
      } else if (round.dealerPlayerId !== ids[index % ids.length]) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has the wrong dealer.` });
      }
      const bids = ids.map((id) => round.bids[id]);
      const tricks = ids.map((id) => round.tricks[id]);
      if (bids.some((value) => value === undefined || value > round.cards)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has invalid bids.` });
      } else if (
        bids.reduce((sum, value) => sum + value, 0) === round.cards
        && !(round.cards === 1 && game.settings.allowExactBidOnOneCard)
      ) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} is exactly bid.` });
      }
      if (tricks.some((value) => value === undefined || value > round.cards)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has invalid results.` });
      } else if (tricks.reduce((sum, value) => sum + value, 0) !== round.cards) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} results do not add up.` });
      }
      if (game.settings.trumpMode === "cycle" && round.trump !== TRUMP_SEQUENCE[index % TRUMP_SEQUENCE.length]) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} does not match the trump cycle.` });
      }
    });
  });

function upgradeLegacyCompletedGame(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (input.settings || !input.scoring || !Array.isArray(input.players)) return value;
  if (input.players.length < MIN_PLAYERS || input.players.length > MAX_PLAYERS) return value;
  return {
    ...input,
    settings: {
      ...settingsForPreset("betting-game", input.players.length),
      preset: "custom",
      scoring: {
        ...DEFAULT_SCORING,
        ...(typeof input.scoring === "object" ? input.scoring : {}),
      },
    },
  };
}

export const completedGameSchema = z.preprocess(upgradeLegacyCompletedGame, completedGameBaseSchema);

export type CompletedGameInput = z.infer<typeof completedGameSchema>;
