# BRSA pitch demo — build plan

Kickoff doc for a late session. Do **not** touch live KlipKlop (klipklop.co.za, its Supabase, its Paystack). This is a **separate pitch-ready demo** so BRSA can click around and want it.

When starting: `@BRSA-PITCH-PLAN.md` and say **go**.

---

## Goal

A 10-minute walkthrough that feels like a real BRSA platform. Hand the laptop over; it should still work.

**Bar:** pitch-ready (~1.5–2 weeks, one person), not a slideshow, not a production ledger.

**Buy-in moments (must actually update state):**

1. Rider enters a jackpot → pay later = not in draw → pay now → name appears.
2. Results unofficial (7-day banner) → admin marks official → points land on the **rider** → standings move → Top Rider notification.
3. Payout receipt: 70% rider / BRSA admin / ground levy → remainder in wallet.
4. Fan boost → feed item → rider wallet ticks.
5. Unpaid fine **blocks** next entry. Membership-due warning on the rider.

Set dressing they should *notice*, not sit through: Hall of Fame, home-page sponsor, Biggest Fan, prior-year standings stub, invoices inbox.

---

## Non-goals (this demo)

- Live Paystack / debit orders / real withdrawals
- Wiring into KlipKlop DB or deploying onto klipklop.co.za
- Full SA member-number migration, Pro-Card at R100k, producer-of-the-year maths
- WhatsApp ticketing, full rulebook PDF (link/placeholder is enough)
- Club/family-head as a paid tier (SAWMGA, not BRSA)
- WMG matrix, 13 games, levels 0–4, nationals eligibility

---

## Product decisions (locked)

| Decision | Choice |
|---|---|
| App | **New app**, sibling of KlipKlop — copy UI primitives, not the domain |
| Host | **Cloudflare Pages** (`*.pages.dev` is fine for the meeting) |
| Data | **Seeded demo world** (JSON + in-memory / localStorage). No live DB required |
| Payments | Fake “Pay” that flips seed state |
| Auth | Demo logins only (no email signup). Personas below |
| Season | BRSA **July–June** |
| Points | 5 pts per horse entered; 5→1 for 1st–5th **per division**; points on **rider**, not combo |
| Results | Unofficial 7 days, then official (standings live only after official) |

Open until kickoff (placeholders OK day one):

- App sub vs included in BRSA membership — show **both** as a settings toggle or two pricing notes, don’t pick a fight in the pitch
- BRSA logo / colours / sponsor mark — placeholders if missing
- Custom domain vs `*.pages.dev`

---

## Personas (demo logins)

Hardcoded. Switching user reloads the same world from that seat.

| Login | Role | Why they’re in the pitch |
|---|---|---|
| `rider` / `demo` | Rider — **Sunny** (SA1001, Adult, Gauteng) | Entry, wallet, profile, blocked-by-fine |
| `fan` / `demo` | Supporter — **Sarel** | Follow, boost, Biggest Fan |
| `producer` / `demo` | Producer — Eastern Cape show | Flyer, admin fee, ground levy |
| `admin` / `demo` | BRSA admin | Mark official, fines, membership due, HOF |

Seed ~8 riders, ~6 horses, **2 events**: one unofficial jackpot (this weekend), one official rodeos last month. A handful of invoices (entry, membership, one unpaid fine).

---

## Screens (build these, in this order)

### Week 1 — money story

1. **Shell** — BRSA branding, nav by role, demo user switcher (visible, pitch-friendly)
2. **Home** — main sponsor logo, upcoming event, Top Rider, membership chip
3. **Events** — list Mini-Qualifier / Jackpot / Rodeo; open flyer + producer + class fees
4. **Enter** — class (Training R250 … Open R450, Futurity, carry-over +R300), pay now / pay later, fine gate
5. **Draw** — only **paid** names
6. **Results** — divisional 1D/2D/3D, unofficial banner + clock, admin “Make official”
7. **Standings** — tabs: Points, Earnings, LTE, Horse (1D/2D/3D), province + prior year stub
8. **Wallet + payouts** — boost, receipt split, day-member winnings → membership

### Week 2 — world that looks lived-in

9. **Public rider + barn** — cover, bio, rank, LTE, records, sponsors, rodeos, Biggest Fan, horse LTE/rank/futurity
10. **News feed vs Community** — admin/system items vs rider posts (photo/video/result)
11. **Membership + invoices + fines** — due warning, kick-out copy, inbox, block entry
12. **Producer + admin** — per-event admin fee, contacts by region, member count (admin only)
13. **Hall of Fame + rulebook tab** — cards + download placeholder + quick rules (dress / tack / welfare)
14. **Polish** — global search, social/WhatsApp links, mobile pass of the 10-minute path

---

## Seed data (one world)

Keep it in `src/demo/world.js` (or JSON) so every screen reads the same store.

Must stay consistent:

- Sunny enters **West Fest Jackpot** on horse **Diesel** in Adult + carry-over
- Sarel is Biggest Fan of Sunny; one boost already in the feed
- Unofficial event: results in, not official, standings **do not** include it yet
- Official event: points already on rider profiles / standings
- Sunny has an **unpaid late-admin fine** until admin/rider pays it in the demo
- Fees: Training 250, Peewee 250, Junior 300, Youth 350, Adult 350, Senior 350, Open 450, carry-over +300
- Membership: Peewee 300 / Junior 350 / Youth 400 / Adult 600 / Senior 600 / Futurity horse 350
- Payout: 70% pool; R150 of entry as producing cost (adjustable); rest BRSA admin

Points helper (demo, not a real ledger):

```
entered horses * 5  +  placePoints(divisionPlace)   // place: 1→5, 2→4, … 5→1
accumulate on riderId, not horseId
futurity: points on horse; carry-over also adds to rider
```

---

## Stack

- Vite + React + Tailwind (same as KlipKlop — copy `src/components/ui/*`, do not import across apps long-term)
- Demo store: React context + seed file; persist to `localStorage` so a refresh mid-pitch doesn’t reset
- Cloudflare Pages; `_redirects`: `/* /index.html 200`
- Wrangler to deploy (`wrangler pages deploy dist` or git-connected Pages)
- **No** KlipKlop Supabase. Optional D1 later — not for v1 pitch

Folder (suggested, sibling or nested):

```
brsa-demo/
  src/
    demo/world.js          # seed
    demo/store.jsx         # mutations: pay, official, boost, payFine
    pages/                 # screens above
    components/ui/         # copied primitives
  public/_redirects
  wrangler.toml            # Pages project name
```

If nested inside this repo, **do not** change KlipKlop routes, env, or Vercel config.

---

## Deploy (when the UI is clickable)

1. Need Cloudflare token with **Pages** (Workers AI token on KlipKlop is too narrow)
2. New Pages project, not the KlipKlop site
3. `npm run build` → `wrangler pages deploy dist --project-name=brsa-pitch`
4. Meeting URL: `https://brsa-pitch.pages.dev` (or whatever we name it)

---

## Pitch script (acceptance test)

Drive this without notes. If any step fails, the demo is not done.

1. Land as **admin** → home shows sponsor + Top Rider.
2. Switch to **Sunny** → membership chip, open West Fest flyer, try enter → **blocked by fine**.
3. Pay fine from invoices → enter Adult + carry-over → **pay later** → draw does not list Sunny.
4. Pay entry → Sunny on the draw.
5. Open results (unofficial) → standings **unchanged**.
6. Switch **admin** → Make official → points on Sunny, standings move, Top Rider toast if applicable.
7. Open payout receipt → 70% / BRSA / ground; wallet updates.
8. Switch **Sarel** → boost Sunny → feed item → Sunny wallet up.
9. Open Sunny’s public profile + Diesel in the barn. Glance Hall of Fame.
10. Switch **producer** → event admin fee / contact.

---

## Kickoff checklist (insomnia session)

- [x] Confirm: **go**, Cloudflare Pages, nested `brsa-demo/` vs new folder
- [x] Logo / colours if any; else charcoal/dust/western, not KlipKlop green
- [x] Scaffold Vite app, copy UI kit, demo user switcher, seed `world.js`
- [x] Day 1 target: home + events + enter + draw (pay later vs pay now)
- [x] Do not migrate KlipKlop, do not add BRSA tables to live Supabase

---

## Source of truth

- Spec: `c:\Users\User\Downloads\BRSA Platform Specs.docx`
- Live contrast: KlipKlop = SAWMGA tracker; this demo = BRSA federation + money + social
- This file: locked product calls. If the spec and this file fight, **this file wins for the demo**; note the delta for later “flesh out for BRSA.”
