import { z } from "zod";
import { CARD_SEQUENCE, MAX_PLAYERS, MIN_PLAYERS, TRUMP_SEQUENCE } from "@/lib/game";

const valueMap = z.record(z.string().uuid(), z.number().int().min(0).max(7));

export const completedGameSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    players: z
      .array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(40) }))
      .min(MIN_PLAYERS)
      .max(MAX_PLAYERS),
    rounds: z.array(
      z.object({
        roundNumber: z.number().int().min(1).max(CARD_SEQUENCE.length),
        cards: z.number().int().min(1).max(7),
        trump: z.enum(TRUMP_SEQUENCE),
        dealerPlayerId: z.string().uuid(),
        bids: valueMap,
        tricks: valueMap,
      }),
    ),
  })
  .superRefine((game, ctx) => {
    if (game.rounds.length !== CARD_SEQUENCE.length) {
      ctx.addIssue({ code: "custom", message: `A completed game must contain ${CARD_SEQUENCE.length} rounds.` });
      return;
    }
    const ids = game.players.map(({ id }) => id);
    const normalised = game.players.map(({ name }) => name.trim().replace(/\s+/g, " ").toLowerCase());
    if (new Set(normalised).size !== normalised.length) {
      ctx.addIssue({ code: "custom", message: "Player names must be unique." });
    }
    game.rounds.forEach((round, index) => {
      if (round.roundNumber !== index + 1 || round.cards !== CARD_SEQUENCE[index]) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} does not match the required card sequence.` });
      }
      if (!ids.includes(round.dealerPlayerId)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has an unknown dealer.` });
      }
      const bids = ids.map((id) => round.bids[id]);
      const tricks = ids.map((id) => round.tricks[id]);
      if (bids.some((value) => value === undefined || value > round.cards)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has invalid bids.` });
      } else if (bids.reduce((sum, value) => sum + value, 0) === round.cards) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} is exactly bid.` });
      }
      if (tricks.some((value) => value === undefined || value > round.cards)) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} has invalid results.` });
      } else if (tricks.reduce((sum, value) => sum + value, 0) !== round.cards) {
        ctx.addIssue({ code: "custom", message: `Round ${index + 1} results do not add up.` });
      }
    });
  });

export type CompletedGameInput = z.infer<typeof completedGameSchema>;
