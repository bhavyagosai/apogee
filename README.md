# Apogee

A daily rarity word game. Seven prompts a day, the same for everyone, 25 seconds each. You type one answer; the rarer it is among all players, the farther your rocket flies — from the launch pad past the Kármán line, the Moon, Mars and Voyager. The obvious answer barely leaves your hand.

Tiers: Paper Plane (10) · Weather Balloon (15) · Jetliner (30) · Orbiter (60) · Deep Space (85) · Apogee (100, one gem per prompt).

## Develop

```bash
pnpm install
cp .env.example .env.local   # defaults work locally
pnpm dev                     # http://localhost:3000
```

Play data (runs, answer popularity) lives in a local SQLite file at `data/apogee.db` via libsql; point `DATABASE_URL` at Turso in production.

| Env var               | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | libsql URL. Default `file:data/apogee.db`.                  |
| `DATABASE_AUTH_TOKEN` | Turso auth token (production only).                         |
| `RECEIPT_SECRET`      | HMAC key for signed answer receipts. Required in production. |

## Content pipeline

Each day is a file `content/days/YYYY-MM-DD.json` holding seven prompts and their full answer sets with tiers (see `src/lib/game/types.ts`). Days roll over at 00:00 UTC.

Answer sets are curated by `scripts/curate.ts`, which drives the Claude Code CLI headlessly (`claude -p`) on your subscription — no API key needed:

```bash
# seven prompts, one per line
pnpm curate --date 2026-11-28 --prompts prompts/2026-11-28.txt --model sonnet

# dry-run a single prompt and print its tiers
pnpm curate --prompt "Name a type of pasta shape" --model sonnet
```

Per prompt the script runs four model calls:

1. **plan** — pick a long-tail source: a **Wikidata** SPARQL `WHERE` body (films, rivers, species, pasta types…), a **dictionary** filter over the ENABLE word list (letter/spelling prompts), or **none** (everyday things). The query is wrapped with English labels, aliases and `sitelinks` counts and run against `query.wikidata.org`; a failing or empty query is fed back to the model for up to three attempts.
2. **generate** — a wide answer list with aliases from the model's own knowledge.
3. **audit** — drop answers that don't satisfy the prompt. The 150 most familiar long-tail items (by sitelinks) the model didn't name are audited too.
4. **tier** — the obvious ones (Paper Plane), the go-to "clever" picks (Weather Balloon), Jetliner, Orbiter, and exactly one Apogee with a fun-fact quip. Everything unlisted — including the rest of the long tail — is Deep Space.

Answers and aliases are deduped by the game's `normalize()` key. Every model response and SPARQL result is cached under `content/cache/`, so re-runs are free; pass `--force` to regenerate. One to three minutes per prompt with Sonnet; Wikidata queries take 2–60 s.

Skim each day's Paper/Jetliner lists before publishing — the model's sense of "obvious" is Western, so Indian and Asian answers sometimes need adding by hand. Day files hot-reload in dev.
