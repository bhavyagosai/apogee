import { NextResponse } from "next/server";
import { answerCounts, percentileFor, recordRun } from "@/lib/db";
import { dayNumberFor, isValidDate } from "@/lib/game/calendar";
import { getDay } from "@/lib/game/content";
import { verifyReceipt } from "@/lib/game/receipt";
import { PROMPTS_PER_DAY } from "@/lib/game/tiers";
import type { CompleteRequest, CompleteResponse, RoundResult } from "@/lib/game/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Partial<CompleteRequest>;
  try {
    body = (await req.json()) as Partial<CompleteRequest>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { date, playerId, runId, receipts } = body;
  if (!isValidDate(date) || !playerId || !runId || !Array.isArray(receipts) || receipts.length !== PROMPTS_PER_DAY) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const day = await getDay(date);
  if (!day) return NextResponse.json({ error: "Unknown day" }, { status: 404 });

  const rounds: RoundResult[] = [];
  for (let i = 0; i < PROMPTS_PER_DAY; i++) {
    const p = verifyReceipt(String(receipts[i]));
    const expectedId = `p${i + 1}`;
    if (!p || p.date !== date || p.playerId !== playerId || p.runId !== runId || p.promptId !== expectedId) {
      return NextResponse.json({ error: `Receipt ${i + 1} doesn't check out.` }, { status: 400 });
    }
    const prompt = day.content.prompts[i];
    rounds.push({ promptId: p.promptId, text: prompt.text, answer: p.answer, tier: p.tier, score: p.score, others: 0 });
  }

  const score = rounds.reduce((s, r) => s + r.score, 0);
  await recordRun({ runId, playerId, date, score });

  const counts = await answerCounts(
    date,
    rounds.filter((r) => r.tier).map((r) => ({ promptId: r.promptId, answer: r.answer })),
  );
  for (const r of rounds) {
    if (r.tier) r.others = Math.max(0, (counts.get(r.promptId) ?? 1) - 1);
  }

  const { betterThan, totalRuns } = await percentileFor(date, score);
  const res: CompleteResponse = { date, dayNumber: dayNumberFor(date), score, betterThan, totalRuns, rounds };
  return NextResponse.json(res);
}
