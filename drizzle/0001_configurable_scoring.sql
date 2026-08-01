ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "scoring_mode" text DEFAULT 'tricks' NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "points_per_unit" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "exact_bid_bonus" integer DEFAULT 10 NOT NULL;
