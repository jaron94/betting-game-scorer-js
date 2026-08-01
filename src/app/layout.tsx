import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betting Game Scorer",
  description: "Score Contract Whist games and follow the Elo leaderboard.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#103f36",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="Betting Game Scorer home">
            <span className="brand-mark" aria-hidden="true">♠</span>
            <span>
              <strong>Betting Game</strong>
              <small>Scorer</small>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/">Score a game</Link>
            <Link href="/leaderboard">Leaderboard</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <span>Contract Whist, minus the arithmetic.</span>
          <span className="suit-row" aria-hidden="true">♠ <i>♥</i> ♦ <i>♣</i></span>
        </footer>
      </body>
    </html>
  );
}
