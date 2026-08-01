import { NextResponse } from "next/server";
import { databaseConfigured } from "@/db";
import { getLeaderboard } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseConfigured()) return NextResponse.json({ configured: false, leaderboard: [] });
  try {
    return NextResponse.json({ configured: true, leaderboard: await getLeaderboard() });
  } catch {
    return NextResponse.json(
      { configured: true, leaderboard: [], error: "The leaderboard is temporarily unavailable." },
      { status: 500 },
    );
  }
}
