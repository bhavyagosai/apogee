import { NextResponse } from "next/server";
import { recordSubmission } from "@/lib/db";
import { isValidDate, utcDateString } from "@/lib/game/calendar";
import { getPrompt } from "@/lib/game/content";
import { matchAnswer } from "@/lib/game/match";
import { issueReceipt } from "@/lib/game/receipt";
import { MAX_ANSWER_LENGTH, TIERS } from "@/lib/game/tiers";
import type { SubmitRequest, SubmitResponse } from "@/lib/game/types";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export async function POST(req: Request) {
  let body: Partial<SubmitRequest>;
  try {
    body = (await req.json()) as Partial<SubmitRequest>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { date, playerId, runId, promptId } = body;
  const answer = typeof body.answer === "string" ? body.answer.slice(0, MAX_ANSWER_LENGTH) : "";
  if (!isValidDate(date) || date !== utcDateString()) {
    return NextResponse.json({ error: "That launch window has closed." }, { status: 400 });
  }
  if (!ID_RE.test(playerId ?? "") || !ID_RE.test(runId ?? "") || !/^p[1-7]$/.test(promptId ?? "")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const found = await getPrompt(date, promptId!);
  if (!found) return NextResponse.json({ error: "Unknown prompt" }, { status: 404 });

  const trimmed = answer.trim();
  const match = trimmed ? matchAnswer(found.index, trimmed) : null;
  const tier = match ? match.entry.tier : null;
  const canonical = match ? match.entry.answer : trimmed;
  const score = tier ? TIERS[tier].score : 0;

  // A miss doesn't end the round: no receipt, nothing recorded, the player tries again.
  if (!match && trimmed) {
    const res: SubmitResponse = { accepted: false, answer: trimmed, tier: null, score: 0 };
    return NextResponse.json(res);
  }

  await recordSubmission({ runId: runId!, promptId: promptId!, date, answer: canonical, tier, score });

  const res: SubmitResponse = {
    accepted: !!match,
    answer: canonical,
    tier,
    score,
    ...(match?.entry.tier === "apogee" && match.entry.quip ? { quip: match.entry.quip } : {}),
    receipt: issueReceipt({ date, playerId: playerId!, runId: runId!, promptId: promptId!, answer: canonical, tier, score }),
  };
  return NextResponse.json(res);
}
