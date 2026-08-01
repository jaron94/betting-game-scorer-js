"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SCORING,
  MAX_PLAYERS,
  MIN_PLAYERS,
  createGame,
  currentRound,
  pointsFor,
  positionsFor,
  rollback,
  roundSequenceFor,
  submitBids,
  submitTricks,
  totalsFor,
  type GameState,
  type PlayerSetup,
  type ScoringConfig,
  type ScoringMode,
  type Trump,
} from "@/lib/game";
import type { SavedRating } from "@/db/save-game";

const STORAGE_KEY = "betting-game-scorer-active-game-v1";
const suitLabels: Record<Trump, { symbol: string; label: string }> = {
  spades: { symbol: "♠", label: "Spades" },
  hearts: { symbol: "♥", label: "Hearts" },
  diamonds: { symbol: "♦", label: "Diamonds" },
  clubs: { symbol: "♣", label: "Clubs" },
  none: { symbol: "—", label: "No trumps" },
};

export function Scorer() {
  const [game, setGame] = useState<GameState | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let savedGame: GameState | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        savedGame = { ...parsed, scoring: parsed.scoring ?? { ...DEFAULT_SCORING } };
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      if (savedGame) setGame(savedGame);
      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    else localStorage.removeItem(STORAGE_KEY);
  }, [game, restored]);

  function startOver() {
    if (game && !window.confirm("Start a new game and remove the saved game from this device?")) return;
    setGame(null);
  }

  if (!restored) return <section className="scorer-shell loading-card">Looking for a saved game…</section>;
  return (
    <>
      {game ? null : <GameIntro />}
      <section className={`scorer-shell${game ? " active-game-shell" : ""}`} aria-label="Game scorer">
        {game ? <ActiveGame game={game} onChange={setGame} onStartOver={startOver} /> : <GameSetup onStart={setGame} />}
      </section>
      {game ? null : <RulesOverview />}
    </>
  );
}

function GameIntro() {
  return (
    <section className="hero">
      <div className="eyebrow">Flexible rounds · {MIN_PLAYERS}–{MAX_PLAYERS} players · Elo ranked</div>
      <h1>Keep your eyes on the cards.</h1>
      <p>We’ll remember every bid, total every score, and settle the leaderboard when the last trick lands.</p>
    </section>
  );
}

function RulesOverview() {
  return (
    <section className="rules-strip" aria-label="Scoring rules">
      <article><span>01</span><h2>Bid carefully</h2><p>The table cannot bid exactly the number of available tricks.</p></article>
      <article><span>02</span><h2>Choose your scoring</h2><p>Use the core rules or score the signed difference from each bid.</p></article>
      <article><span>03</span><h2>Climb the table</h2><p>Final positions update a multiplayer Elo rating after each game.</p></article>
    </section>
  );
}

function GameSetup({ onStart }: { onStart: (game: GameState) => void }) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(["", "", "", ""]);
  const [scoring, setScoring] = useState<ScoringConfig>({ ...DEFAULT_SCORING });
  const [error, setError] = useState("");
  const cardSequence = roundSequenceFor(count);
  const highestRound = cardSequence[0];

  function updateCount(next: number) {
    setCount(next);
    setNames((current) => Array.from({ length: next }, (_, index) => current[index] ?? ""));
  }

  function start() {
    try {
      onStart(createGame(names, scoring));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the game.");
    }
  }

  return (
    <div className="setup-grid">
      <div className="setup-copy">
        <div className="step-label">Game setup</div>
        <h2>Who’s at the table?</h2>
        <p>Enter players in dealing order. The first name deals round one.</p>
        <p>{cardSequence.length} {cardSequence.length === 1 ? "round" : "rounds"} · {highestRound === 1 ? "1 card" : `${highestRound} → 1 → ${highestRound}`}</p>
        <label className="count-label">Number of players <strong>{count}</strong></label>
        <input className="range" type="range" min={MIN_PLAYERS} max={MAX_PLAYERS} value={count} onChange={(event) => updateCount(Number(event.target.value))} />
        <div className="range-labels"><span>{MIN_PLAYERS}</span><span>{MAX_PLAYERS}</span></div>
      </div>
      <div className="player-form">
        {names.map((name, index) => (
          <label key={index}>
            <span>{index === 0 ? "First dealer" : `Player ${index + 1}`}</span>
            <input value={name} maxLength={40} autoComplete="off" placeholder={index === 0 ? "e.g. Jonathan" : "Name"} onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value : value))} />
          </label>
        ))}
        <fieldset className="scoring-settings">
          <legend>Scoring rules</legend>
          <label>
            <span>Scoring method</span>
            <select
              value={scoring.mode}
              onChange={(event) => setScoring((current) => ({
                ...current,
                mode: event.target.value as ScoringMode,
              }))}
            >
              <option value="tricks">Core — tricks won + exact bonus</option>
              <option value="difference">Difference — tricks minus bid</option>
            </select>
          </label>
          <div className="scoring-number-grid">
            <label>
              <span>{scoring.mode === "tricks" ? "Points per trick" : "Points per trick difference"}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                value={scoring.pointsPerUnit}
                onChange={(event) => setScoring((current) => ({
                  ...current,
                  pointsPerUnit: Number(event.target.value),
                }))}
              />
            </label>
            <label>
              <span>{scoring.mode === "tricks" ? "Exact-bid bonus" : "Points for exact bid"}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                value={scoring.exactBidBonus}
                onChange={(event) => setScoring((current) => ({
                  ...current,
                  exactBidBonus: Number(event.target.value),
                }))}
              />
            </label>
          </div>
          <p>
            {scoring.mode === "tricks"
              ? `${scoring.pointsPerUnit} per trick, plus ${scoring.exactBidBonus} for an exact bid.`
              : `${scoring.exactBidBonus} for an exact bid; otherwise ${scoring.pointsPerUnit} × (tricks − bid).`}
          </p>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" onClick={start}>Deal the first round <span>→</span></button>
      </div>
    </div>
  );
}

function ActiveGame({ game, onChange, onStartOver }: { game: GameState; onChange: (game: GameState) => void; onStartOver: () => void }) {
  const cardSequence = roundSequenceFor(game.players.length);
  const totals = useMemo(
    () => totalsFor(game.players, game.rounds, game.scoring),
    [game.players, game.rounds, game.scoring],
  );
  const [error, setError] = useState("");

  if (game.stage === "complete") return <FinishedGame game={game} totals={totals} onStartOver={onStartOver} />;
  const round = currentRound(game);
  const suit = suitLabels[round.trump];

  function undo() {
    try {
      onChange(rollback(game));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo that step.");
    }
  }

  return (
    <>
      <div className="game-toolbar">
        <div><span className="step-label">Round {round.roundNumber} of {cardSequence.length}</span><strong>{round.cards} {round.cards === 1 ? "card" : "cards"} · <i className={round.trump === "hearts" || round.trump === "diamonds" ? "red-suit" : ""}>{suit.symbol}</i> {suit.label}</strong></div>
        <div className="toolbar-actions"><button className="text-button" onClick={undo}>↶ Undo</button><button className="text-button danger" onClick={onStartOver}>New game</button></div>
      </div>
      <div className="progress-track"><span style={{ width: `${((game.roundIndex + (game.stage === "results" ? 0.5 : 0)) / cardSequence.length) * 100}%` }} /></div>
      <div className="play-layout">
        <RoundEntry key={`${game.roundIndex}-${game.stage}`} game={game} error={error} setError={setError} onSubmit={onChange} />
        <Standings players={game.players} totals={totals} roundsPlayed={game.rounds.length} dealerId={round.dealer.id} />
      </div>
      {game.rounds.length > 0 && <ScoreHistory game={game} />}
    </>
  );
}

function RoundEntry({ game, error, setError, onSubmit }: { game: GameState; error: string; setError: (error: string) => void; onSubmit: (game: GameState) => void }) {
  const round = currentRound(game);
  const isBidding = game.stage === "bidding";
  const initial = Object.fromEntries(game.players.map(({ id }) => [id, isBidding ? 0 : game.pendingBids[id] ?? 0]));
  const [values, setValues] = useState<Record<string, number>>(initial);
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  function submit() {
    try {
      onSubmit(isBidding ? submitBids(game, values) : submitTricks(game, values));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check the numbers and try again.");
    }
  }

  return (
    <div className="round-card">
      <div className="round-card-title">
        <div><span className="step-label">{isBidding ? "Before the first card" : "After the last trick"}</span><h2>{isBidding ? "Place the bids" : "Record the results"}</h2></div>
        <div className={`running-total ${(!isBidding && total === round.cards) || (isBidding && total !== round.cards) ? "valid" : ""}`}><strong>{total}</strong><small>{isBidding ? "bid" : `of ${round.cards}`}</small></div>
      </div>
      <div className="stepper-list">
        {round.order.map((player) => (
          <div className="stepper-row" key={player.id}>
            <div className="player-label"><span className="avatar-letter small">{player.name.charAt(0).toUpperCase()}</span><span><strong>{player.name}</strong>{player.id === round.dealer.id && <small>Dealer</small>}</span></div>
            <div className="stepper">
              <button aria-label={`Decrease ${player.name}`} onClick={() => setValues((current) => ({ ...current, [player.id]: Math.max(0, current[player.id] - 1) }))}>−</button>
              <input aria-label={`${player.name} ${isBidding ? "bid" : "tricks"}`} type="number" inputMode="numeric" min="0" max={round.cards} value={values[player.id]} onChange={(event) => setValues((current) => ({ ...current, [player.id]: Math.min(round.cards, Math.max(0, Number(event.target.value) || 0)) }))} />
              <button aria-label={`Increase ${player.name}`} onClick={() => setValues((current) => ({ ...current, [player.id]: Math.min(round.cards, current[player.id] + 1) }))}>+</button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" onClick={submit}>{isBidding ? "Lock in bids" : "Score this round"}<span>→</span></button>
    </div>
  );
}

function Standings({ players, totals, roundsPlayed, dealerId }: { players: PlayerSetup[]; totals: Record<string, number>; roundsPlayed: number; dealerId: string }) {
  const sorted = [...players].sort((a, b) => totals[b.id] - totals[a.id]);
  return (
    <aside className="standings-card">
      <div className="side-heading"><span>Live table</span><small>{roundsPlayed} played</small></div>
      <ol>
        {sorted.map((player, index) => (
          <li key={player.id}><span className="place">{index + 1}</span><span className="standing-name"><strong>{player.name}</strong>{player.id === dealerId && <small>dealing</small>}</span><strong className="score">{totals[player.id]}</strong></li>
        ))}
      </ol>
      <p>Scores are saved on this device after every step.</p>
    </aside>
  );
}

function ScoreHistory({ game }: { game: GameState }) {
  const running = Object.fromEntries(game.players.map(({ id }) => [id, 0]));
  return (
    <details className="history-card">
      <summary>Round history <span>{game.rounds.length} completed</span></summary>
      <div className="table-scroll"><table><thead><tr><th>Round</th>{game.players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead>
        <tbody>{game.rounds.map((round) => <tr key={round.roundNumber}><th>{round.roundNumber}<small>{round.cards} cards · {suitLabels[round.trump].symbol}</small></th>{game.players.map((player) => { running[player.id] += pointsFor(round.bids[player.id], round.tricks[player.id], game.scoring); return <td key={player.id}><strong>{running[player.id]}</strong><small>{round.bids[player.id]} / {round.tricks[player.id]}</small></td>; })}</tr>)}</tbody>
      </table></div>
    </details>
  );
}

function FinishedGame({ game, totals, onStartOver }: { game: GameState; totals: Record<string, number>; onStartOver: () => void }) {
  const positions = positionsFor(game.players, totals);
  const ordered = [...game.players].sort((a, b) => totals[b.id] - totals[a.id]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState<SavedRating[]>([]);

  async function publish() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", "x-scorer-access-code": code },
        body: JSON.stringify({
          id: game.id,
          createdAt: game.createdAt,
          players: game.players,
          rounds: game.rounds,
          scoring: game.scoring,
        }),
      });
      const payload = (await response.json()) as { error?: string; ratings?: SavedRating[] };
      if (!response.ok) throw new Error(payload.error ?? "The game could not be published.");
      setRatings(payload.ratings ?? []);
      setStatus("saved");
      localStorage.removeItem(STORAGE_KEY);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "The game could not be published.");
    }
  }

  return (
    <div className="finish-card">
      <div className="winner-banner"><span className="step-label">Game complete</span><div className="trophy">♠</div><h2>{ordered.filter((player) => positions[player.id] === 1).map(({ name }) => name).join(" & ")} {ordered.filter((player) => positions[player.id] === 1).length > 1 ? "tie" : "wins"}!</h2><p>{game.rounds.length} {game.rounds.length === 1 ? "round" : "rounds"}, counted and settled.</p></div>
      <ol className="final-table">
        {ordered.map((player) => { const rating = ratings.find(({ name }) => name === player.name); return <li key={player.id}><span className="place">{positions[player.id]}</span><span><strong>{player.name}</strong>{rating && <small>{rating.change >= 0 ? "+" : ""}{rating.change.toFixed(1)} Elo · now {Math.round(rating.ratingAfter)}</small>}</span><strong>{totals[player.id]} pts</strong></li>; })}
      </ol>
      <div className="publish-panel">
        {status === "saved" ? <div className="success-message"><strong>Published to the leaderboard</strong><span>The ratings are up to date.</span></div> : <>
          <label><span>Scorer access code <small>(if configured)</small></span><input type="password" value={code} autoComplete="off" onChange={(event) => setCode(event.target.value)} placeholder="Shared code" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={status === "saving"} onClick={publish}>{status === "saving" ? "Publishing…" : "Publish result"}<span>↑</span></button>
        </>}
      </div>
      <button className="text-button finish-new" onClick={onStartOver}>Start another game</button>
    </div>
  );
}
