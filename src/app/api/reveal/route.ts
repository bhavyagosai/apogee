import { NextResponse } from "next/server";
import { isValidDate, utcDateString } from "@/lib/game/calendar";
import { getDay } from "@/lib/game/content";
import { verifyReceipt } from "@/lib/game/receipt";
import { TIERS } from "@/lib/game/tiers";
import type { RevealResponse } from "@/lib/game/types";

export const dynamic = "force-dynamic";

/**
 * The full manifest for a day. Today's is only handed out to a player who
 * can show a receipt for its last prompt, so the answer sets can't be read
 * before a flight; past days are open.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? utcDateString();
  if (!isValidDate(date)) return NextResponse.json({ error: "Bad date" }, { status: 400 });

  if (date === utcDateString()) {
    const proof = verifyReceipt(url.searchParams.get("receipt") ?? "");
    if (!proof || proof.date !== date || proof.promptId !== "p7") {
      return NextResponse.json({ error: "Finish today's flight first." }, { status: 403 });
    }
  }

  const day = await getDay(date);
  if (!day) return NextResponse.json({ error: "Unknown day" }, { status: 404 });

  const body: RevealResponse = {
    date,
    prompts: day.content.prompts.map((p) => ({
      id: p.id,
      text: p.text,
      // Sorted so the client can render the manifest top-down without the aliases.
      answers: [...p.answers]
        .sort((a, b) => TIERS[b.tier].score - TIERS[a.tier].score || a.answer.localeCompare(b.answer))
        .map(({ answer, tier, quip }) => ({ answer, tier, ...(quip ? { quip } : {}) })),
    })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
