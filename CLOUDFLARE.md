# Cloudflare hosting (KlipKlop)

Preview is live. Apex `klipklop.co.za` stays on Vercel until you explicitly say to cut DNS.

Do not deploy these Workers to the Master Drilling account. Both Workers are pinned to Laskalegacypty (`8b60730ec10ba7eb7e85d214fa2505c2`). Leave the BRSA demo Worker (`brsa-demo`) alone.

## Preview URLs

- App (SPA Worker `klipklop`): https://klipklop.klipklop.workers.dev
- Utilities Worker `klipklop-api` (debug only; the app talks to it via a service binding): https://klipklop-api.klipklop.workers.dev

Same-origin `/api/*` on the app URL is forwarded to `klipklop-api`. `/api/health` returns `{ ok: true, service: "klipklop-api" }`.

## Architecture

Browser → `klipklop` (static `dist/` + SPA fallback)
`/api/*` → service binding → `klipklop-api`
Browser still talks to Supabase Auth / Postgres / Storage directly (login, times, horses, photos).
`klipklop-api` holds server secrets, existing Vercel-style handlers, and D1 (`klipklop`).

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

## Secrets (klipklop-api only)

Already set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_APP_URL`, `CF_ACCOUNT_ID`.

Still required before Klippies, reports, share-link redeem, and Event Day API routes work (they use the service role). Chat needs a Workers AI token:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c workers/api/wrangler.toml
npx wrangler secret put CF_API_TOKEN -c workers/api/wrangler.toml
# optional
npx wrangler secret put CF_MODEL -c workers/api/wrangler.toml
```

Get the service role key from the Supabase project settings (never `VITE_`-prefix it, never put it on the SPA Worker). After it is set, dump current rows into D1:

```bash
npm run d1:export
npx wrangler d1 execute klipklop --remote --file=scripts/.d1-export.sql -c workers/api/wrangler.toml
```

Klippies waitlist / request / log already dual-write into D1 when those API routes succeed.

## D1

- Database name: `klipklop`
- Database id: `dbdb023c-102c-4c64-ab60-d1bb2544cf93`
- Schema: [migrations/d1/0001_init.sql](migrations/d1/0001_init.sql)
- Binding on `klipklop-api`: `DB`

This is a copy of the live tables (SQLite types, no RLS). The React app does **not** read D1 yet.

## After tonight (move call sites onto the utilities Worker, then D1)

1. Add JWT-checked routes on `klipklop-api` for hot client queries (times, profiles, horses). Re-apply the same permission rules RLS has today; do not expose a generic SQL/query proxy.
2. Flip those routes from Supabase → D1 one resource at a time (dump script already exists).
3. Storage → R2 via utilities upload routes (`avatars`, `horse-photos`, `videos`).
4. Paystack / Resend / Web Push Edge Functions → utilities routes. Update the Paystack webhook URL when that happens.
5. Chat: polling or a Durable Object; drop Supabase Realtime.
6. Last: Auth sessions on the Worker, then remove the browser Supabase client.

## Apex cutover (blocked)

Do this only when you say go:

1. Add a Worker custom domain on **`klipklop`** (the SPA Worker) for `klipklop.co.za` and `www` if used.
2. Set `PUBLIC_APP_URL` to `https://klipklop.co.za` on `klipklop-api`.
3. Leave Vercel up a few days as fallback, then remove Vercel DNS.

`/api` stays same-origin through the service binding. Do not point the apex at `klipklop-api`.
