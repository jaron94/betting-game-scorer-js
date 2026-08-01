"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  chooseTrump,
  createGame,
  currentRound,
  maxCardsFor,
  pointsFor,
  positionsFor,
  rollback,
  restoreGameState,
  roundSequenceFor,
  settingsForPreset,
  submitBids,
  submitTricks,
  totalsFor,
  type GamePreset,
  type GameSettings,
  type GameState,
  type PlayerSetup,
  type ScoringMode,
  type Trump,
} from "@/lib/game";
import type { SavedRating } from "@/db/save-game";
import {
  GAME_PUBLISHED_EVENT,
  useOffline,
} from "@/components/offline-provider";

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
        savedGame = restoreGameState(JSON.parse(saved));
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
      <div className="eyebrow">Flexible rules · {MIN_PLAYERS}–{MAX_PLAYERS} players · Elo ranked</div>
      <h1>Keep your eyes on the cards.</h1>
      <p>We’ll remember every bid, total every score, and settle the leaderboard when the last trick lands.</p>
    </section>
  );
}

function RulesOverview() {
  return (
    <section className="rules-strip" aria-label="Scoring rules">
      <article><span>01</span><h2>Bid carefully</h2><p>Except in the simultaneous one-card round, total bids cannot equal the available tricks.</p></article>
      <article><span>02</span><h2>Choose your rules</h2><p>Start with Betting Game, Oh Hell, or the alternative, then tailor every setting.</p></article>
      <article><span>03</span><h2>Climb the table</h2><p>Final positions update a multiplayer Elo rating after each game.</p></article>
    </section>
  );
}

function GameSetup({ onStart }: { onStart: (game: GameState) => void }) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(["", "", "", ""]);
  const [settings, setSettings] = useState<GameSettings>(() => settingsForPreset("betting-game", 4));
  const [error, setError] = useState("");
  const cardSequence = roundSequenceFor(count, settings.startingCards, settings.endingCards);

  function updateCount(next: number) {
    setCount(next);
    setNames((current) => Array.from({ length: next }, (_, index) => current[index] ?? ""));
    setSettings((current) => {
      if (current.preset !== "custom") return settingsForPreset(current.preset, next);
      const maximum = maxCardsFor(next);
      return {
        ...current,
        startingCards: Math.min(current.startingCards, maximum),
        endingCards: Math.min(current.endingCards, maximum),
      };
    });
  }

  function start() {
    try {
      onStart(createGame(names, settings));
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
        <p>{cardSequence.length} {cardSequence.length === 1 ? "round" : "rounds"} · {scheduleLabel(settings.startingCards, settings.endingCards)}</p>
        <label className="count-label">Number of players <strong>{count}</strong></label>
        <input className="range" type="range" min={MIN_PLAYERS} max={MAX_PLAYERS} value={count} onChange={(event) => updateCount(Number(event.target.value))} />
        <div className="range-labels"><span>{MIN_PLAYERS}</span><span>{MAX_PLAYERS}</span></div>
      </div>
      <div className="player-form">
        <GameSettingsEditor
          playerCount={count}
          settings={settings}
          onChange={setSettings}
        />
        {names.map((name, index) => (
          <label className={index === 0 ? "first-player" : undefined} key={index}>
            <span>{index === 0 ? "First dealer" : `Player ${index + 1}`}</span>
            <input value={name} maxLength={40} autoComplete="off" placeholder={index === 0 ? "e.g. Jonathan" : "Name"} onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value : value))} />
          </label>
        ))}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" onClick={start}>Deal the first round <span>→</span></button>
      </div>
    </div>
  );
}

function scheduleLabel(startingCards: number, endingCards: number): string {
  if (startingCards === 1) return endingCards === 1 ? "1 card" : `1 → ${endingCards}`;
  return endingCards === 1 ? `${startingCards} → 1` : `${startingCards} → 1 → ${endingCards}`;
}

function GameSettingsEditor({
  playerCount,
  settings,
  onChange,
}: {
  playerCount: number;
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
}) {
  const maximum = maxCardsFor(playerCount);
  const cardOptions = Array.from({ length: maximum }, (_, index) => index + 1);

  function customise(patch: Partial<GameSettings>) {
    onChange({ ...settings, ...patch, preset: "custom" });
  }

  function updateScoring(patch: Partial<GameSettings["scoring"]>) {
    customise({ scoring: { ...settings.scoring, ...patch } });
  }

  function selectPreset(preset: GamePreset) {
    if (preset !== "custom") onChange(settingsForPreset(preset, playerCount));
  }

  return (
    <fieldset className="rules-settings">
      <legend>Game rules</legend>
      <div className="settings-grid">
        <label className="wide-setting">
          <span>Rules preset</span>
          <select value={settings.preset} onChange={(event) => selectPreset(event.target.value as GamePreset)}>
            <option value="betting-game">Betting game</option>
            <option value="oh-hell">Oh Hell</option>
            <option value="betting-alternative">Betting game alternative</option>
            {settings.preset === "custom" ? <option value="custom">Custom</option> : null}
          </select>
        </label>
        <label>
          <span>Starting cards</span>
          <select value={settings.startingCards} onChange={(event) => customise({ startingCards: Number(event.target.value) })}>
            {cardOptions.map((cards) => <option value={cards} key={cards}>{cards}</option>)}
          </select>
        </label>
        <label>
          <span>Ending cards</span>
          <select value={settings.endingCards} onChange={(event) => customise({ endingCards: Number(event.target.value) })}>
            {cardOptions.map((cards) => <option value={cards} key={cards}>{cards}</option>)}
          </select>
        </label>
        <label className="wide-setting">
          <span>Scoring method</span>
          <select value={settings.scoring.mode} onChange={(event) => updateScoring({ mode: event.target.value as ScoringMode })}>
            <option value="tricks">Tricks won + exact-bid bonus</option>
            <option value="bid">Oh Hell — bid value + bonus when exact</option>
            <option value="difference">Tricks minus bid + exact-bid bonus</option>
          </select>
        </label>
        <label>
          <span>{settings.scoring.mode === "bid" ? "Points per bid / miss" : settings.scoring.mode === "tricks" ? "Points per trick" : "Points per difference"}</span>
          <input type="number" inputMode="numeric" min="0" max="100" value={settings.scoring.pointsPerUnit} onChange={(event) => updateScoring({ pointsPerUnit: Number(event.target.value) })} />
        </label>
        <label>
          <span>Exact-bid bonus</span>
          <input type="number" inputMode="numeric" min="0" max="100" value={settings.scoring.exactBidBonus} onChange={(event) => updateScoring({ exactBidBonus: Number(event.target.value) })} />
        </label>
        {settings.scoring.mode === "bid" ? (
          <label className="wide-setting">
            <span>When the bid is missed</span>
            <select value={settings.scoring.missedBidScoring} onChange={(event) => updateScoring({ missedBidScoring: event.target.value as GameSettings["scoring"]["missedBidScoring"] })}>
              <option value="zero">Score zero</option>
              <option value="negative">Lose points for each trick away</option>
            </select>
          </label>
        ) : null}
        <label className="wide-setting">
          <span>Trumps</span>
          <select value={settings.trumpMode} onChange={(event) => customise({ trumpMode: event.target.value as GameSettings["trumpMode"] })}>
            <option value="cycle">Cycle ♠, ♥, ♦, ♣, then no trumps</option>
            <option value="manual">Choose each round (for a cut card)</option>
          </select>
        </label>
        <label>
          <span>Who bids first?</span>
          <select value={settings.bidFirst} onChange={(event) => customise({ bidFirst: event.target.value as GameSettings["bidFirst"] })}>
            <option value="dealer">Dealer</option>
            <option value="next">Next player</option>
          </select>
        </label>
        <label>
          <span>Who leads?</span>
          <select value={settings.leadFirst} onChange={(event) => customise({ leadFirst: event.target.value as GameSettings["leadFirst"] })}>
            <option value="dealer">Dealer</option>
            <option value="next">Next player</option>
          </select>
        </label>
        <label className="check-setting wide-setting">
          <input type="checkbox" checked={settings.allowExactBidOnOneCard} onChange={(event) => customise({ allowExactBidOnOneCard: event.target.checked })} />
          <span>Allow total bids to equal one trick in the one-card forehead round</span>
        </label>
      </div>
      <p>{scoringDescription(settings)}</p>
    </fieldset>
  );
}

function scoringDescription(settings: GameSettings): string {
  const scoring = settings.scoring;
  if (scoring.mode === "tricks") return `${scoring.pointsPerUnit} per trick, plus ${scoring.exactBidBonus} for an exact bid.`;
  if (scoring.mode === "difference") return `${scoring.exactBidBonus} for an exact bid; otherwise ${scoring.pointsPerUnit} × (tricks − bid).`;
  const miss = scoring.missedBidScoring === "zero" ? "zero when missed" : `−${scoring.pointsPerUnit} per trick away when missed`;
  return `${scoring.exactBidBonus} + ${scoring.pointsPerUnit} × bid when exact; ${miss}.`;
}

function ActiveGame({ game, onChange, onStartOver }: { game: GameState; onChange: (game: GameState) => void; onStartOver: () => void }) {
  const cardSequence = roundSequenceFor(
    game.players.length,
    game.settings.startingCards,
    game.settings.endingCards,
  );
  const totals = useMemo(
    () => totalsFor(game.players, game.rounds, game.settings.scoring),
    [game.players, game.rounds, game.settings.scoring],
  );
  const [error, setError] = useState("");

  if (game.stage === "complete") return <FinishedGame game={game} totals={totals} onStartOver={onStartOver} />;
  const round = currentRound(game);
  const suit = round.trump ? suitLabels[round.trump] : null;

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
        <div>
          <span className="step-label">Round {round.roundNumber} of {cardSequence.length}</span>
          <strong>{round.cards} {round.cards === 1 ? "card" : "cards"} · {suit ? <><i className={round.trump === "hearts" || round.trump === "diamonds" ? "red-suit" : ""}>{suit.symbol}</i> {suit.label}</> : "Choose trumps"}</strong>
          <small className="round-order">Dealer: {round.dealer.name} · {round.cards === 1 ? "Simultaneous bids" : `${round.bidOrder[0].name} bids first`} · {round.leadOrder[0].name} leads</small>
        </div>
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
  const allowExactlyBid = round.cards === 1 && game.settings.allowExactBidOnOneCard;
  const initial = Object.fromEntries(game.players.map(({ id }) => [id, isBidding ? 0 : game.pendingBids[id] ?? 0]));
  const [values, setValues] = useState<Record<string, number>>(initial);
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const order = isBidding ? round.bidOrder : round.leadOrder;

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
      {isBidding && game.settings.trumpMode === "manual" ? (
        <label className="trump-picker">
          <span>Trumps for this round</span>
          <select value={game.pendingTrump ?? ""} onChange={(event) => onSubmit(chooseTrump(game, event.target.value as Trump))}>
            <option value="" disabled>Choose from the cut card…</option>
            {Object.entries(suitLabels).map(([value, suit]) => <option value={value} key={value}>{suit.symbol} {suit.label}</option>)}
          </select>
        </label>
      ) : null}
      <div className="round-card-title">
        <div><span className="step-label">{isBidding ? "Before the first card" : "After the last trick"}</span><h2>{isBidding ? "Place the bids" : "Record the results"}</h2></div>
        <div className={`running-total ${(!isBidding && total === round.cards) || (isBidding && (total !== round.cards || allowExactlyBid)) ? "valid" : ""}`}><strong>{total}</strong><small>{isBidding ? "bid" : `of ${round.cards}`}</small></div>
      </div>
      {isBidding && round.cards === 1 ? <p className="one-card-note">Hold each card on its player’s forehead and bid simultaneously. {allowExactlyBid ? "The total may equal one." : "The total still cannot equal one."}</p> : null}
      <div className="stepper-list">
        {order.map((player, index) => {
          const role = player.id === round.dealer.id
            ? "Dealer"
            : index === 0 && (!isBidding || !allowExactlyBid)
              ? isBidding ? "Bids first" : "Leads"
              : null;
          return (
            <div className="stepper-row" key={player.id}>
              <div className="player-label"><span className="avatar-letter small">{player.name.charAt(0).toUpperCase()}</span><span><strong>{player.name}</strong>{role ? <small>{role}</small> : null}</span></div>
              <div className="stepper">
                <button aria-label={`Decrease ${player.name}`} onClick={() => setValues((current) => ({ ...current, [player.id]: Math.max(0, current[player.id] - 1) }))}>−</button>
                <input aria-label={`${player.name} ${isBidding ? "bid" : "tricks"}`} type="number" inputMode="numeric" min="0" max={round.cards} value={values[player.id]} onChange={(event) => setValues((current) => ({ ...current, [player.id]: Math.min(round.cards, Math.max(0, Number(event.target.value) || 0)) }))} />
                <button aria-label={`Increase ${player.name}`} onClick={() => setValues((current) => ({ ...current, [player.id]: Math.min(round.cards, current[player.id] + 1) }))}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={isBidding && game.settings.trumpMode === "manual" && !game.pendingTrump} onClick={submit}>{isBidding ? "Lock in bids" : "Score this round"}<span>→</span></button>
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
        <tbody>{game.rounds.map((round) => <tr key={round.roundNumber}><th>{round.roundNumber}<small>{round.cards} cards · {suitLabels[round.trump].symbol}</small></th>{game.players.map((player) => { running[player.id] += pointsFor(round.bids[player.id], round.tricks[player.id], game.settings.scoring); return <td key={player.id}><strong>{running[player.id]}</strong><small>{round.bids[player.id]} / {round.tricks[player.id]}</small></td>; })}</tr>)}</tbody>
      </table></div>
    </details>
  );
}

function FinishedGame({ game, totals, onStartOver }: { game: GameState; totals: Record<string, number>; onStartOver: () => void }) {
  const positions = positionsFor(game.players, totals);
  const ordered = [...game.players].sort((a, b) => totals[b.id] - totals[a.id]);
  const { isOnline, publishGame } = useOffline();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "queued" | "saved">("idle");
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState<SavedRating[]>([]);

  useEffect(() => {
    const published = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; ratings: SavedRating[] }>).detail;
      if (detail.id !== game.id) return;
      setRatings(detail.ratings);
      setStatus("saved");
      setError("");
      localStorage.removeItem(STORAGE_KEY);
    };
    window.addEventListener(GAME_PUBLISHED_EVENT, published);
    return () => window.removeEventListener(GAME_PUBLISHED_EVENT, published);
  }, [game.id]);

  async function publish() {
    setStatus("saving");
    setError("");
    try {
      const result = await publishGame({
        id: game.id,
        createdAt: game.createdAt,
        players: game.players,
        rounds: game.rounds,
        settings: game.settings,
      }, code);
      setRatings(result.ratings);
      setStatus(result.status === "published" ? "saved" : "queued");
      setError(result.error ?? "");
      if (result.status === "published") localStorage.removeItem(STORAGE_KEY);
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "The result could not be saved on this device.");
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
          {status === "queued" ? (
            <div className="queued-message" role="status">
              <strong>Saved on this device</strong>
              <span>{isOnline ? "Waiting to publish to the leaderboard." : "It will publish when you reconnect."}</span>
            </div>
          ) : null}
          <label><span>Scorer access code <small>(if configured)</small></span><input type="password" value={code} autoComplete="off" onChange={(event) => setCode(event.target.value)} placeholder="Shared code" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={status === "saving"} onClick={publish}>{status === "saving" ? "Saving…" : status === "queued" ? "Try publishing now" : "Publish result"}<span>↑</span></button>
        </>}
      </div>
      <button className="text-button finish-new" onClick={onStartOver}>Start another game</button>
    </div>
  );
}
