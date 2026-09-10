# Changelog

All notable changes to the BRSA pitch/demo app, in the order they were built. This is a fast-iteration, localStorage-only demo (`brsa-demo`) used to explore and validate UX/feature ideas — separate from the production Cloverleaf engine.

Each entry links back to its commit hash in this repo (`git show <hash>` for the full diff).

---

## 2026-09-10 — Full spec-conformance audit backlog

The complete "BRSA Platform & App" product spec was audited section-by-section against the live code (67 spec bullets across 19 sections). Each item below is one section of that backlog.

- **Payments & payouts** (`ecbce91`) — Corrected the fee-split formula: BRSA's 30% admin cut is now taken from gross entry fees first, with the remaining 70% (the payout pool) then reduced by producing costs to get the prize pool. Previously producing costs were deducted *before* the 70/30 split, letting venue costs erode BRSA's admin percentage — fixed in both the official `makeOfficial()` calculation and the live Payout-tab estimate, which had its own separate, independently-stale copy of the same formula. Day-member/guest entries now get an unpaid membership invoice alongside their entry invoice, so a winning payout can actually apply itself toward membership per spec. `issueMembershipInvoice` now auto-pays from wallet immediately when the rider has debit order enabled and sufficient balance, actually implementing the "automatic renewal" feature.
- **Hall of Fame** (`3c4d37e`) — Added a fixed `HOF_CATEGORIES` taxonomy (BRSA Record, South African Record, Championship Win, plus a Special Recognition catch-all) with a required Category select separate from the free-text achievement field, category badges, and filter buttons. Seeded one real BRSA Record and one South African Record so the taxonomy is demonstrable.
- **Standings & rank** (`e7c7974`) — Points tab now breaks out by class instead of one flat list. Prior Years is a real multi-season board (season field + selector) instead of one static snapshot. Horse tab is computed from real results (most wins, tiebreak by fastest average time, official results only) with a 1D/2D/3D selector, instead of sorting by LTE. Top Rider feed posts now link to the rider's profile.
- **Point system** (`69cf48c`) — Removed an undocumented flat +5 bonus that was being applied to every carry-over entry regardless of class. Fixed Futurity carry-over so the rider is credited the *same* points as the horse (per spec), not an unrelated flat bonus.
- **News Feed vs Community** (`8fbf578`) — Birthdays are now a real, idempotent feed post generated at load time instead of a page-level banner recomputed on every render. Monthly awards split into real categories (Best Run, Video Post, Best Venue, Cowboy/Cowgirl of the Month). Community posts support video. Added "Share a result," which posts one of the rider's own real timed runs as a structured card.
- **Boost/wallet** (`629c3ac`, `12ffee1`, `02ef284`, `c1bec56`) — Generalized `withdrawWallet`/`updateBankDetails` to work for fans as well as riders; added a Top Supporters leaderboard (aggregates boosts by sender). Added fan/supporter profiles (`/fans/:fanId`) with a Supporter → Rider upgrade flow. Let anyone without a wallet of their own (a sponsor, for instance) make a direct payment to a rider. Moved wallet balance back onto the rider-only Dashboard and off the publicly-viewable RiderProfile.
- **Rider profiles** (`08560c1`, `552b4b1`, `da992a1`, `dd85851`) — Built out the seeded rider account as the demo persona (Liani van der Walt): full profile/cover photos, bio, sponsors, a second horse, season results, matching invoices. Fixed a wallet-balance exposure on RiderProfile (any viewer could previously see another rider's balance).

**Bugs found and fixed while working through the above** (each recurs across multiple pages, so treat as standing rules — see `CLAUDE.md`/project memory for the full detail):
- The shared `Card` component's own `bg-white`/`border-dust-200` classes silently beat a `className` override intended to recolor it, because the `cn()` helper is a plain string-join with no Tailwind-merge dedup. Hit three separate times (cover-photo contrast, filter dropdown widths, feed accent cards) — the fix is either a plain `<div>` with the full class string authored directly, or a bespoke CSS custom-property class.
- A rules-of-hooks violation in `MyTimes.jsx` (an early return before several `useMemo` calls) crashed the page when switching from a non-rider role to rider without a full reload.
- `RiderProfile.jsx`/`Dashboard.jsx` double-counted a rider's "shows attended" when they entered two horses at the same event, because the aggregation filtered raw entries without deduping by event id.

## 2026-09-09 — Money flows, live event running, role re-scope

- **Re-scoped Admin vs Producer** (`c836275`, `9f4a927`) — Producer became the primary operational role: creating/editing events, running the draw, recording times, marking events official, issuing fines, adjusting standings, and posting news all moved from Admin to Producer, at both the store guard and the UI gate. Admin was trimmed to "View as member" only — a genuine app-support function, not a BRSA business one. New Producer Dashboard consolidates BRSA wallet, unpaid invoices, membership-due count, and the full event calendar.
- **Event Day console** (`da23e75`, `4105cf8`, `79bfd24`, `533b36a`, `8e84693`, `b033f49`, `ae0993a`) — Built a real running console for producers: a Roster phase (verify the paid field, copy a no-login late-entry link, warn on missing draw numbers) followed by a Running phase (heats of 5, a Table view, and a phone/tablet-tuned Timekeeper person-by-person view). Supports 1- or 2-run events, with the better of two runs becoming official. Times are editable after entry. PDF/CSV/TXT timesheet upload works throughout, auto-detecting the next needed run per horse. Fixed a sidebar-highlighting bug and made the Timekeeper view a genuine stand-alone screen (no header/tab chrome).
- **Events manager** (`7b1e050`, `667d923`) — Producers get an Entries manager (paid/unpaid status, mark-paid, a shareable no-login guest-entry link for day members), a Draw PDF export, and a live pre-official Payout estimate. Added event create/edit, a featured "Up next" Home banner, and rulebook-compliant random draw shuffling. Added a "Live today" status that always has one event running for demo purposes.
- **Payments, fines, membership money flows** (`2996940`, `7312695`, `991a76b`, `48cc63f`) — Winning payouts now automatically apply toward a rider's outstanding membership invoice, with a "write off — take as cash instead" reversal option. Added wallet withdrawal, debit-order auto-renew toggles, an admin fine-issuing composer, and a bank-statement-style transaction ledger. Merged the standalone Invoices page into Wallet (one page, branching by role) and added PDF invoice generation via jsPDF.
- **Results engine** (`d55bfc9`) — Added a real division engine (`computeDivisionsAndPlaces`, bucketing 1D–5D off the fastest completed time per rulebook Section E.3) and timesheet parsing, replacing what had been static seed data.
- **My Times / Time Queries** (`bf81602`, `571c99c`, `59cde21`, `fee62ed`) — Built the 7-day result-query workflow: riders can query an unofficial time, producers can accept (which re-opens it for re-timing), reject, or ask for more detail. Split into Your Runs / Queries tabs, added year/province filters.
- **Brand & navigation pass** (`b2b502e`, `0ce932d`, `abec6db`, `f49b824`, `a3e7cf6`, `f1ed22b`) — Swapped fonts (Outfit/Cormorant Garamond → Inter/Oswald), moved to a collapsible left side nav, brought in the real BRSA logo/horse-head brand assets, and made the global back button a proper labeled, keyboard-accessible control.
- **Content fill-out** (`9bf1eeb`, `8973bc0`, `b499023`, `f0be631`, `637202e`, `0ca8c45`, `5ef032b`) — News Feed now covers rule updates, monthly awards, entry/follow notifications, and live birthday detection. Horses got full pedigree/physical detail fields. Standings got manual point adjustment and prior-year entry creation. Hall of Fame became admin-editable. The complete BRSA Rule Book (Sections A–L) was transcribed into structured data with a searchable, section-indexed Rules page.

## 2026-09-08 — Initial build

- **Initial import** (`55e0af4`) — BRSA pitch demo extracted from the klipklop repo as its own standalone project.
- **Rider profiles** (`84a2724`) — Editable profile (photo/cover/bio/sponsors/achievements), a horse profile page, and admin-editable app subscription pricing.
- **Role switcher** (`f933723`) — A visible demo role dropdown (admin/rider/fan/producer) for instantly switching personas while building, separate from Admin's audited "view as member" impersonation flow.
- **Barn** (`864182b`) — Riders can register and edit their own horses, not just tweak seed data.
- **Home / Dashboard split** (`cbbe995`) — Home became a public, federation-wide overview; personal/membership content moved to a new rider-only Dashboard with a Nationals-qualification tracker.
- **Rider profile parity + Events rework** (`bd4ad04`) — Searched-for rider profiles show the same rank/qualification stats as a rider's own Dashboard. Events page gained search and type/region/status filters.
- **Community rebuild** (`360c987`) — Instagram-style feed: post composer, like/comment threads, and a follow toggle that sorts followed riders' posts to the top.

---

*Every commit in this history carries `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` — this file was generated from `git log` on 2026-09-10 and should be extended (not regenerated) as new work lands.*
