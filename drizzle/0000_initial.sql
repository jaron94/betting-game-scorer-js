CREATE TABLE "players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "normalised_name" text NOT NULL,
  "rating" numeric(10,4) DEFAULT '1000' NOT NULL,
  "games_played" integer DEFAULT 0 NOT NULL,
  "wins" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
  "id" uuid PRIMARY KEY NOT NULL,
  "played_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_players" (
  "game_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "finishing_position" integer NOT NULL,
  "final_score" integer NOT NULL,
  "rating_before" numeric(10,4) NOT NULL,
  "rating_after" numeric(10,4) NOT NULL,
  "rating_change" numeric(10,4) NOT NULL,
  CONSTRAINT "game_players_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
  "id" serial PRIMARY KEY NOT NULL,
  "game_id" uuid NOT NULL,
  "round_number" integer NOT NULL,
  "cards" integer NOT NULL,
  "trump" text NOT NULL,
  "dealer_player_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_results" (
  "round_id" integer NOT NULL,
  "player_id" uuid NOT NULL,
  "bid" integer NOT NULL,
  "tricks" integer NOT NULL,
  "points" integer NOT NULL,
  "total_score" integer NOT NULL,
  CONSTRAINT "round_results_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_dealer_player_id_players_id_fk" FOREIGN KEY ("dealer_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "players_normalised_name_unique" ON "players" USING btree ("normalised_name");
--> statement-breakpoint
CREATE INDEX "game_players_player_idx" ON "game_players" USING btree ("player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_game_round_unique" ON "rounds" USING btree ("game_id","round_number");
