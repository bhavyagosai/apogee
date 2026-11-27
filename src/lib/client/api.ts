import type {
  CompleteRequest,
  CompleteResponse,
  RevealResponse,
  SubmitRequest,
  SubmitResponse,
  TodayResponse,
} from "@/lib/game/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

export const api = {
  today: () => call<TodayResponse>("/api/today", { cache: "no-store" }),
  submit: (req: SubmitRequest) => call<SubmitResponse>("/api/submit", { method: "POST", body: JSON.stringify(req) }),
  complete: (req: CompleteRequest) =>
    call<CompleteResponse>("/api/complete", { method: "POST", body: JSON.stringify(req) }),
  reveal: (date: string, receipt: string) =>
    call<RevealResponse>(`/api/reveal?date=${date}&receipt=${encodeURIComponent(receipt)}`, undefined, 15000),
};
