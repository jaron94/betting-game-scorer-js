import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseConfigured } from "@/db";
import { saveCompletedGame } from "@/db/save-game";
import { completedGameSchema } from "@/lib/validation";

function authorised(request: Request): boolean {
  const requiredCode = process.env.SCORER_ACCESS_CODE;
  if (!requiredCode) return true;
  const suppliedCode = request.headers.get("x-scorer-access-code") ?? "";
  const expected = Buffer.from(requiredCode);
  const supplied = Buffer.from(suppliedCode);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "The database has not been configured." }, { status: 503 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "That scorer access code is not valid." }, { status: 401 });
  }

  const parsed = completedGameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "The game data is invalid." },
      { status: 400 },
    );
  }

  try {
    const ratings = await saveCompletedGame(parsed.data);
    return NextResponse.json({ ratings }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The game could not be saved.";
    const duplicate = /games_pkey/i.test(message);
    if (duplicate) {
      return NextResponse.json({ ratings: [], alreadyPublished: true }, { status: 200 });
    }
    return NextResponse.json(
      { error: "The game could not be saved." },
      { status: 500 },
    );
  }
}
