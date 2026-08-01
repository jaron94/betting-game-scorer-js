# Betting Game Scorer

A mobile-first scorer for the Betting Game (Contract Whist), rebuilt from the original R Shiny application with Next.js and TypeScript. Finished games are stored in Postgres and update a multiplayer Elo leaderboard.

## Features

- Configurable starting and ending cards, constrained by a 52-card deck
- Betting Game, Oh Hell, and Betting Game Alternative presets with editable settings
- Automatic suit/no-trumps cycling or manual trump choice from a cut card
- Independent first-bidder and leader rules
- Bid and trick validation, including simultaneous forehead bidding and the one-card exact-bid exception
- Core, Oh Hell, and signed-difference scoring with configurable values
- Installable Progressive Web App with a cached scorer for reliable offline play
- Live standings, rollback, and local autosave after every step
- Durable offline result queue with automatic publishing after reconnection
- Last-known leaderboard available offline with a visible saved-data timestamp
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

## Offline use

Open the deployed app once while online so its service worker can cache the scorer. It can then be installed from the browser and reopened without a connection. Active games remain in local storage, while completed results waiting to publish are kept separately in IndexedDB. Queued results are retried automatically when the connection returns while the app is open, or when the app is next launched online.

If `SCORER_ACCESS_CODE` is configured, the code is never stored on the device. A queued result that needs authorisation remains safe in the outbox and the app prompts for the code after reconnection. The leaderboard shows its last downloaded snapshot offline and clearly labels when that snapshot was saved.

## Rules and presets

Every preset fills the setup fields, and any field can then be changed independently. The card sequence descends from the starting count to one; if the ending count is greater than one, it then climbs to that count.

- **Betting Game:** starts at 7 and returns to 7; scores one point per trick plus 10 for an exact bid; cycles through spades, hearts, diamonds, clubs, and no trumps; the dealer bids first and the next player leads.
- **Oh Hell:** starts at 10 and ends at 1; scores 10 plus the bid when exact and either zero or a negative distance penalty when missed; trumps are entered each round from a cut card; the next player bids first and leads.
- **Betting Game Alternative:** uses the Betting Game schedule, trumps, and order, but scores `(tricks − bid)` plus 10 when exact. Bidding 2 and taking 3 scores 1; bidding 3 and taking 1 scores −2.

Starting cards, ending cards, scoring method and values, trump determination, bidding order, leading order, and the one-card exact-bid exception can all be customised. On a one-card round, players hold cards to their foreheads and bid simultaneously.

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
npm run test:e2e
npm run build
```

The Playwright suite starts the Next.js app and checks scoring, installation metadata, offline reloads, queued publishing after reconnection, and cached leaderboard access in Chromium. Install the browser once before running it locally:

```bash
npx playwright install chromium
```

## Deploy to Vercel

1. Import this repository at [vercel.com/new](https://vercel.com/new).
2. Accept the detected Next.js settings.
3. Add `DATABASE_URL` and `SCORER_ACCESS_CODE` in Project Settings → Environment Variables.
4. Deploy. Each push to `main` will trigger a new production deployment.

Run the migration locally against the production `DATABASE_URL` before saving the first game.
