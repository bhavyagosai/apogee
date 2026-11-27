import { createHmac, timingSafeEqual } from "node:crypto";
import type { ResultTier } from "./types";

export interface ReceiptPayload {
  v: 1;
  date: string;
  playerId: string;
  runId: string;
  promptId: string;
  answer: string;
  tier: ResultTier;
  score: number;
  issuedAt: number;
}

function secret(): string {
  const s = process.env.RECEIPT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("RECEIPT_SECRET is required in production");
  return "apogee-dev-secret";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issueReceipt(payload: Omit<ReceiptPayload, "v" | "issuedAt">): string {
  const full: ReceiptPayload = { v: 1, ...payload, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyReceipt(token: string): ReceiptPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ReceiptPayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}
