# KlipKlop Hub

Hub portal + **separate division apps**. Do not merge BRSA into SAWMGA `src/`, or WMG matrix into BRSA.

## workers.dev preview (current)

| Piece | URL |
|---|---|
| **Hub** | https://klipklop.klipklop.workers.dev |
| **Rider** | https://klipklop-rider.klipklop.workers.dev — central account (details, subs, payments) |
| **Horse Health** | https://klipklop-horse-health.klipklop.workers.dev — care logs & due alerts |
| **Admin (UI template)** | https://klipklop-admin.klipklop.workers.dev — staff gate |
| **SAWMGA** | https://klipklop-sawmga.klipklop.workers.dev |
| **BRSA** | https://brsa-demo.klipklop.co.za (also `brsa-demo.klipklop.workers.dev`) |
| **Endurance** | Coming soon (hub card only) |

Apex `klipklop.co.za` stays on Vercel until an explicit cutover.

## Ownership

| Layer | Owns |
|---|---|
| **Hub** (`apps/hub/`) | Brand home, division picker, later account |
| **Rider** (`apps/rider/`) | Central rider account — profile, KlipKlop subscriptions & payments (not association memberships) |
| **Horse Health** (`apps/horse-health/`) | Per-horse care tracker — vaccines, vet, farrier, due alerts |
| **Admin** (`apps/admin/`) | Staff-only home of the shared UI template |
| **SAWMGA** (root `src/`, Worker `klipklop-sawmga`) | Matrix, qualifiers, Nationals, Event Day, Klippies, Paystack sub |
| **BRSA** (`brsa-demo/` → later `apps/brsa`) | Wallet, events, producer desk, Barry, feed/yard |
| **Shared UI** | [`packages/ui`](packages/ui) (`@klipklop/ui`) — colour-agnostic controls; divisions inject `--kk-*` |

## Shared UI template

Colour-agnostic control chrome lives in `@klipklop/ui`. The **admin app** is where the template is curated (presets, live token editor, control gallery). Apps import `index.css` + React primitives (or plain `kk-*` classes). Identity is injected with `applyTheme` / `applyPreset` — see [packages/ui/README.md](packages/ui/README.md).

Preview gate key defaults to `KlipKlop-Admin` (`VITE_ADMIN_KEY`). Replace with Cloudflare Access before any public admin hostname.

## Deploy preview

```bash
# SAWMGA division (build root app → klipklop-sawmga)
npm run deploy:sawmga

# Hub (takes Worker name klipklop on workers.dev)
npm run deploy:hub

# Admin UI template (klipklop-admin)
npm run deploy:admin

# Rider account + Horse Health
npm run deploy:rider
npm run deploy:horse-health
```

Deploy `klipklop-api` first if the SAWMGA API binding is missing: `npm run deploy:api`.
