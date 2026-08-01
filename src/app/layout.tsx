import type { Metadata, Viewport } from "next";
import {
  ConnectionStatus,
  OfflineLink,
  OfflineProvider,
  PendingSyncBanner,
} from "@/components/offline-provider";
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
        <OfflineProvider>
          <header className="site-header">
            <OfflineLink href="/" className="brand" aria-label="Betting Game Scorer home">
              <span className="brand-mark" aria-hidden="true">♠</span>
              <span>
                <strong>Betting Game</strong>
                <small>Scorer</small>
              </span>
            </OfflineLink>
            <div className="header-actions">
              <ConnectionStatus />
              <nav aria-label="Main navigation">
                <OfflineLink href="/">Score a game</OfflineLink>
                <OfflineLink href="/leaderboard">Leaderboard</OfflineLink>
              </nav>
            </div>
          </header>
          <PendingSyncBanner />
          {children}
          <footer className="site-footer">
            <span>Contract Whist, minus the arithmetic.</span>
            <span className="suit-row" aria-hidden="true">♠ <i>♥</i> ♦ <i>♣</i></span>
          </footer>
        </OfflineProvider>
      </body>
    </html>
  );
}
