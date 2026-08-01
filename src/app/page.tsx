import { Scorer } from "@/components/scorer";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">13 rounds · 2–7 players · Elo ranked</div>
        <h1>Keep your eyes on the cards.</h1>
        <p>We’ll remember every bid, total every score, and settle the leaderboard when the last trick lands.</p>
      </section>
      <Scorer />
      <section className="rules-strip" aria-label="Scoring rules">
        <article><span>01</span><h2>Bid carefully</h2><p>The table cannot bid exactly the number of available tricks.</p></article>
        <article><span>02</span><h2>Choose your scoring</h2><p>Use the core rules or score the signed difference from each bid.</p></article>
        <article><span>03</span><h2>Climb the table</h2><p>Final positions update a multiplayer Elo rating after each game.</p></article>
      </section>
    </main>
  );
}
