# Betting Game Scorer

A mobile-first scorer for the Betting Game (Contract Whist), rebuilt from the original R Shiny application with Next.js and TypeScript. Finished games are stored in Postgres and update a multiplayer Elo leaderboard.

## Features

- The original 13-round `7 → 1 → 7` card sequence and rotating dealer order
- Spades, hearts, diamonds, clubs, and no-trumps cycle
- Bid and trick validation, including the “exactly bid” restriction
- Per-game scoring rules, with the original 1-point-per-trick and 10-point exact-bid bonus as defaults
- Optional difference scoring where overtricks are positive and undertricks are negative
- Live standings, rollback, and local autosave
- Complete game, round, score, and Elo history in Postgres
- Pairwise multiplayer Elo with ties and field-size normalisation
- Responsive interface designed for use around a card table

## Local development

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

The scorer works without a database, but completed games cannot be published and the leaderboard remains empty until `DATABASE_URL` is configured.

## Scoring rules

Each game stores the scoring method selected at setup:

- **Core scoring (default):** tricks won × points per trick, plus the exact-bid bonus when the bid is met.
- **Difference scoring:** the exact-bid value when the bid is met; otherwise `(tricks − bid) × points per difference`. For example, bidding 2 and taking 3 scores 1 point with the default multiplier.

Both the per-trick value and exact-bid value can be changed before the game starts. The defaults preserve the original rules: one point per trick and a 10-point exact-bid bonus.

## Database

Create a free Neon Postgres project and copy its pooled connection string into `DATABASE_URL`. Run:

```bash
npm run db:migrate
```

Set `SCORER_ACCESS_CODE` to require a shared code before a completed game can be written. The leaderboard remains public. Without this variable, writes are open to anyone who can reach the app.

## Elo method

Every pair of players in a finished game is treated as an Elo result: higher final score is a win, equal score is a draw. Each player's pairwise changes are summed and divided by `players - 1`, so a seven-player game does not create six times the movement of a head-to-head game. Ratings start at 1000, use `K = 32`, retain decimal precision in the database, and are rounded only for display.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel

1. Import this repository at [vercel.com/new](https://vercel.com/new).
2. Accept the detected Next.js settings.
3. Add `DATABASE_URL` and `SCORER_ACCESS_CODE` in Project Settings → Environment Variables.
4. Deploy. Each push to `main` will trigger a new production deployment.

Run the migration locally against the production `DATABASE_URL` before saving the first game.
