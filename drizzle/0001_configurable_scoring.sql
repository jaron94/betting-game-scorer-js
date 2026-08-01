ALTER TABLE "games" ADD COLUMN "scoring_mode" text DEFAULT 'tricks' NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "points_per_unit" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "exact_bid_bonus" integer DEFAULT 10 NOT NULL;
