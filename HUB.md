# KlipKlop Hub

Hub portal + **separate division apps**. Do not merge BRSA into SAWMGA `src/`, or WMG matrix into BRSA.

## workers.dev preview (current)

| Piece | URL |
|---|---|
| **Hub** | https://klipklop.klipklop.workers.dev |
| **SAWMGA** | https://klipklop-sawmga.klipklop.workers.dev |
| **BRSA** | https://brsa-demo.klipklop.co.za (also `brsa-demo.klipklop.workers.dev`) |
| **Endurance** | Coming soon (hub card only) |

Apex `klipklop.co.za` stays on Vercel until an explicit cutover.

## Ownership

| Layer | Owns |
|---|---|
| **Hub** (`apps/hub/`) | Brand home, division picker, later account |
| **SAWMGA** (root `src/`, Worker `klipklop-sawmga`) | Matrix, qualifiers, Nationals, Event Day, Klippies, Paystack sub |
| **BRSA** (`brsa-demo/` → later `apps/brsa`) | Wallet, events, producer desk, Barry, feed/yard |
| **Shared (later)** | `packages/ui`, media, auth, rules-engine runtime |

## Deploy preview

```bash
# SAWMGA division (build root app → klipklop-sawmga)
npm run deploy:sawmga

# Hub (takes Worker name klipklop on workers.dev)
npm run deploy:hub
```

Deploy `klipklop-api` first if the SAWMGA API binding is missing: `npm run deploy:api`.
