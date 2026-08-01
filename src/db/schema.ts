import {
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    normalisedName: text("normalised_name").notNull(),
    rating: numeric("rating", { precision: 10, scale: 4 }).notNull().default("1000"),
    gamesPlayed: integer("games_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("players_normalised_name_unique").on(table.normalisedName)],
);

export const games = pgTable("games", {
  id: uuid("id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlayers = pgTable(
  "game_players",
  {
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => players.id),
    finishingPosition: integer("finishing_position").notNull(),
    finalScore: integer("final_score").notNull(),
    ratingBefore: numeric("rating_before", { precision: 10, scale: 4 }).notNull(),
    ratingAfter: numeric("rating_after", { precision: 10, scale: 4 }).notNull(),
    ratingChange: numeric("rating_change", { precision: 10, scale: 4 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.playerId] }),
    index("game_players_player_idx").on(table.playerId),
  ],
);

export const rounds = pgTable(
  "rounds",
  {
    id: serial("id").primaryKey(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    cards: integer("cards").notNull(),
    trump: text("trump").notNull(),
    dealerPlayerId: uuid("dealer_player_id").notNull().references(() => players.id),
  },
  (table) => [uniqueIndex("rounds_game_round_unique").on(table.gameId, table.roundNumber)],
);

export const roundResults = pgTable(
  "round_results",
  {
    roundId: integer("round_id").notNull().references(() => rounds.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => players.id),
    bid: integer("bid").notNull(),
    tricks: integer("tricks").notNull(),
    points: integer("points").notNull(),
    totalScore: integer("total_score").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roundId, table.playerId] })],
);
