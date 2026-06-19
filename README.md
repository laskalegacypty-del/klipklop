# KlipKlop (Vite + React + Supabase)

## Run locally

```bash
npm install
npm run dev
```

Create a `.env` file with:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Horses feature (profiles + medical log + reminders)
The Horses UI is available at:
- `/horses`
- `/horses/:horseId`

### 1) Create the database tables + RLS policies
Run the SQL script in Supabase SQL Editor:
- `supabase/horses_schema.sql`

This creates:
- `horses`
- `horse_medical_entries`
- `horse_reminders`

And enables Row Level Security so users only access their own data.

### 2) Create the storage bucket for horse photos
In Supabase Storage, create a **public** bucket named:
- `horse-photos`

The app uploads to `horse-photos/<userId>/<horseId>/photo.<ext>` and saves the resulting public URL on `horses.photo_url`.

## Assistant (chatbot)

The `/assistant` page is a SAWMGA western mounted games chatbot built on the
[`rules-engine`](https://github.com/Geck018/rules-engine) package. It answers:

- **Rules & games questions** — grounded in `SAWMGA-knowledge-base.md`. By default
  (no backend configured) it works fully offline, showing the best-matching rule.
- **Personal questions** — the rider's own horses, recorded times, personal bests,
  levels, medical log, vaccinations and reminders, read RLS-scoped from Supabase.

### Rules dataset
The chatbot reads `public/data/wmg-rules.json`. Regenerate it whenever
`SAWMGA-knowledge-base.md` changes:

```bash
npm run rules:ingest
```

### Conversational answers via Cloudflare Workers AI (free tier)
Conversational answers are produced by Cloudflare Workers AI, called through the
serverless proxy `api/rules/chat.js` so the token stays server-side. Configure
these environment variables (see `.env.example`):

- `CF_ACCOUNT_ID` — Cloudflare account id
- `CF_API_TOKEN` — Cloudflare API token with the **Workers AI** permission
- `CF_MODEL` — optional, defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

Set them in **Vercel → Project Settings → Environment Variables** for production
**after** local Layer 2 testing passes (do not redeploy until the Assistant
lazy-load fix is on the branch you deploy).

### Local Layer 2 testing (full AI + API)

A plain `npm run dev` won't run `/api` — the assistant falls back to offline
rule lookups only. For the full stack locally:

```bash
# Terminal 1 (or single command):
npm run dev:layer2
```

This starts a local API server on port 3001 and Vite on port 5173 (Vite proxies
`/api` to the local server). Sign in, open **Assistant**, and ask questions.

Automated smoke tests (API server must be running):

```bash
npm run dev:api          # terminal 1
npm run test:layer2      # terminal 2
```

Alternatively, after `npx vercel login`, run `npx vercel dev` for the official
Vercel dev server (same env vars in `.env`).

> **Model note:** `@cf/meta/llama-3-8b-instruct` was deprecated 2026-05-30. The
> proxy now defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (free tier).

> Security: never prefix the token with `VITE_` and never commit it. If a token
> has been shared anywhere (chat, screenshots, etc.), rotate it in the Cloudflare
> dashboard.

