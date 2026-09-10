# Cloudflare hosting (KlipKlop)

Preview is live. Apex `klipklop.co.za` stays on Vercel until `npm run go-live`.

Do not deploy these Workers to the Master Drilling account. Both Workers are pinned to Laskalegacypty (`8b60730ec10ba7eb7e85d214fa2505c2`). Leave the BRSA demo Worker (`brsa-demo`) alone.

## Drop in the service role (then go live)

1. Paste `service_role` (Supabase → Project Settings → API) into `workers/api/.dev.vars` on the `SUPABASE_SERVICE_ROLE_KEY=` line. Gitignored; never commit it.
2. `npm run secret:service-role` — puts the key on `klipklop-api` and probes Klippies. Preview is then feature-complete.
3. `npm run go-live` — same put, sets `PUBLIC_APP_URL`, deploys the SPA Worker with `klipklop.co.za` + `www` attached (`wrangler.apex.toml`).

The script refuses the anon key if you paste the wrong JWT.

## Preview URLs

- App (SPA Worker `klipklop`): https://klipklop.klipklop.workers.dev
- Utilities Worker `klipklop-api` (debug only; the app talks to it via a service binding): https://klipklop-api.klipklop.workers.dev

Same-origin `/api/*` on the app URL is forwarded to `klipklop-api`. `/api/health` returns `{ ok: true, service: "klipklop-api" }`.
`GET /api/bff` reports backend mode, bindings, and which resources are D1-ready.

## Architecture

Browser → `klipklop` (static `dist/` + SPA fallback)
`/api/*` → service binding → `klipklop-api`
Browser still talks to Supabase Auth / Postgres / Storage directly (login, times, horses, photos).
`klipklop-api` holds server secrets, existing Vercel-style handlers, the BFF resource routes, and D1 (`klipklop`).

Do not build a generic SQL proxy. Flip one resource at a time onto `/api/{resource}` (see catalog in `api/_lib/catalog.js`), then set Worker `DATA_BACKEND=d1` when that table’s access rules exist in the Worker.

## Deploy

```bash
# utilities first (service binding target must exist)
npm run deploy:api

# SPA (vite build + wrangler deploy)
# Bake VITE_* from a local env file; empty values in `.env` will break login.
set -a && . ./.env.cf-build && set +a
npm run deploy
```

Or `npm run deploy:cf` after exporting `VITE_*`.

Local API with Vite (`/api` proxied to :3001):

```bash
npm run dev:worker-api   # wrangler — D1 / AI / KV
# or
npm run dev:api          # Node wrapper, same router, no CF bindings
```

## Secrets (klipklop-api only)

Already set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_APP_URL`, `CF_ACCOUNT_ID`.

Still required before Klippies, reports, share-link redeem, and Event Day API routes work (they use the service role). Prefer `npm run secret:service-role` over a manual put.

Workers AI is bound as `AI` on `klipklop-api` (no `CF_API_TOKEN` needed for `/api/rules/chat` on Cloudflare). Token remains as a Vercel/local fallback.

When Paystack / Resend / push move off Edge Functions:

```bash
npx wrangler secret put PAYSTACK_SECRET_KEY -c workers/api/wrangler.toml
npx wrangler secret put RESEND_API_KEY -c workers/api/wrangler.toml
npx wrangler secret put VAPID_PRIVATE_KEY -c workers/api/wrangler.toml
```

Get the service role key from the Supabase project settings (never `VITE_`-prefix it, never put it on the SPA Worker). After it is set, dump current rows into D1:

```bash
npm run d1:export
npx wrangler d1 execute klipklop --remote --file=scripts/.d1-export.sql -c workers/api/wrangler.toml
```

Klippies waitlist / request / log already dual-write into D1 when those API routes succeed.

## Bindings

| Binding | Type | Status |
|---|---|---|
| `DB` | D1 `klipklop` (`dbdb023c-102c-4c64-ab60-d1bb2544cf93`) | live, schema applied, app does not read it yet |
| `SESSIONS` | KV `07f57335e7574bd89bb6649df96aa44e` | live, unused until Worker auth |
| `AI` | Workers AI | live, used by `/api/rules/chat` |
| `MEDIA` | R2 `klipklop-media` | **blocked** — enable R2 on the Laskalegacypty dashboard, then `npx wrangler r2 bucket create klipklop-media` and uncomment the `[[r2_buckets]]` block in `workers/api/wrangler.toml` |

## Client flip switches (all default off)

Set in the SPA build env only when you are ready to point that surface at the Worker. Live Vercel / current preview stay on Supabase until then.

- `VITE_USE_BFF=true` — Paystack verify + profile-access email hit `/api/...` instead of `functions/v1/...`
- `VITE_USE_R2=true` — `storageUploads.js` posts to `/api/uploads` (needs R2 enabled)
- Worker `[vars] DATA_BACKEND = "d1"` — BFF reads/writes D1 instead of Supabase (only for `d1Ready` resources; others return 501)

Client helpers (not wired into pages yet): `src/lib/apiClient.js` (`api`, `bff.horses`, `bff.messages`, …).

## BFF route map

JWT resources (Supabase RLS still applies while `DATA_BACKEND=supabase`):

- `GET\|PATCH /api/me`
- `CRUD /api/horses`, `/api/combos`, `/api/medical`, `/api/reminders`, `/api/vaccinations`, `/api/videos`
- `CRUD /api/results`, `/api/pbs`, `/api/events`, `/api/notifications`, `/api/messages`
- `POST /api/uploads` + `GET /api/media/:bucket/*` (R2)
- `POST /api/paystack/verify` + `POST /api/paystack/webhook`
- `POST /api/email/approval` + `POST /api/email/profile-access`
- `POST /api/push/send` — **501 stub** (web-push on Workers not written)

Suggested page flip order: events/times/horses → notifications → chat poll (`/api/messages`, drop Realtime) → uploads → Paystack/email → Auth last.

## After the skeleton (still later)

1. Point call sites at `bff.*` one page at a time. Re-apply RLS in the Worker before flipping `DATA_BACKEND=d1` for that table (club/supporter/grant rules are not in D1 yet).
2. Enable R2, uncomment the bucket, migrate `avatars` / `horse-photos` / `videos`.
3. Point Paystack webhook at `https://klipklop.co.za/api/paystack/webhook` when the apex is on the SPA Worker.
4. Chat: polling is ready; Durable Object is optional if live updates matter.
5. Auth sessions in KV, then remove the browser Supabase client.
6. Drop Vercel.

## Apex cutover

`npm run go-live` after the service role is in `.dev.vars`. That attaches `klipklop.co.za` and `www` to the **SPA** Worker `klipklop` (not `klipklop-api`), sets `PUBLIC_APP_URL`, and leaves Vercel as a fallback until you delete its DNS records.

If Wrangler errors because Vercel A/CNAME records already exist in the zone, delete those two records in Cloudflare DNS and re-run `npm run go-live`.
