import { Leaderboard } from "@/components/leaderboard";

export default function LeaderboardPage() {
  return (
    <main>
      <section className="hero hero-compact">
        <div className="eyebrow">The long game</div>
        <h1>Leaderboard</h1>
        <p>Ratings begin at 1000 and move after every published game.</p>
      </section>
      <Leaderboard />
      <section className="method-note">
        <strong>How ratings work</strong>
        <p>Every finishing position is compared with every other player in that game. Tied scores count as draws, and rating movement is normalised for the number of players.</p>
      </section>
    </main>
  );
}
