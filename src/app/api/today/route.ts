import { NextResponse } from "next/server";
import { dayNumberFor, resetsAtFor, utcDateString } from "@/lib/game/calendar";
import { getDay } from "@/lib/game/content";
import type { TodayResponse } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const date = utcDateString();
  const day = await getDay(date);
  if (!day) {
    return NextResponse.json({ error: "No launch scheduled for today yet.", date }, { status: 404 });
  }
  const body: TodayResponse = {
    date,
    dayNumber: dayNumberFor(date),
    resetsAt: resetsAtFor(date),
    prompts: day.content.prompts.map((p) => ({ id: p.id, text: p.text })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
