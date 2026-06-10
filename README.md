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
- `CF_MODEL` — optional, defaults to `@cf/meta/llama-3-8b-instruct`

Set them in **Vercel → Project Settings → Environment Variables** for production.
For local API testing run `vercel dev` (a plain `npm run dev` won't run the
`/api` function — the assistant then falls back to offline rule lookups).

> Security: never prefix the token with `VITE_` and never commit it. If a token
> has been shared anywhere (chat, screenshots, etc.), rotate it in the Cloudflare
> dashboard.

