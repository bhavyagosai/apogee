import { describe, expect, it } from "vitest";
import { issueReceipt, verifyReceipt } from "@/lib/game/receipt";

describe("receipts", () => {
  const base = { date: "2026-11-26", playerId: "pl_x", runId: "run_x", promptId: "p1", answer: "Time", tier: "paper" as const, score: 10 };
  it("round-trips", () => {
    const r = issueReceipt(base);
    expect(verifyReceipt(r)).toMatchObject(base);
  });
  it("rejects tampering", () => {
    const r = issueReceipt(base);
    const [body, sig] = r.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), score: 100 })).toString("base64url");
    expect(verifyReceipt(`${forged}.${sig}`)).toBeNull();
    expect(verifyReceipt("garbage")).toBeNull();
  });
});
