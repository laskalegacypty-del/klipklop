import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  computeDivisionsAndPlaces,
  entryFee,
  estimatePayout,
  membershipFee,
  parseTimesheet,
  pointsForResult,
  PRODUCING_COST,
  splitFees,
} from './money'
import { createSeed } from './world'
import { applyAccent, defaultAccent } from './accents'

const STORAGE_KEY = 'brsa-pitch-v2'
const DemoContext = createContext(null)

function loadWorld() {
  const seed = createSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === 2) {
        return {
          ...seed,
          ...parsed,
          accent: parsed.accent ?? seed.accent,
          viewingFromAdmin: parsed.viewingFromAdmin ?? false,
          viewAsLog: parsed.viewAsLog ?? [],
          timeQueries: parsed.timeQueries ?? [],
          transactions: parsed.transactions ?? seed.transactions,
          follows: parsed.follows ?? seed.follows,
        }
      }
    }
  } catch {
    /* fall through */
  }
  return seed
}

function ledger(w, row) {
  return { ...w, transactions: [{ id: `tx-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: new Date().toISOString(), ...row }, ...(w.transactions ?? [])] }
}

function birthdayPosts(w) {
  const today = new Date()
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const year = today.getFullYear()
  const extra = []
  for (const r of w.riders) {
    if (!r.birthday) continue
    const riderMd = r.birthday.slice(5)
    if (riderMd !== md) continue
    const id = `feed-bday-${r.id}-${year}`
    if (w.feed.some((f) => f.id === id)) continue
    extra.push({
      id,
      type: 'birthday',
      at: today.toISOString(),
      riderId: r.id,
      text: `Happy birthday, ${r.name}.`,
    })
  }
  return extra.length ? { ...w, feed: [...extra, ...w.feed] } : w
}

export function DemoProvider({ children }) {
  const [world, setWorld] = useState(() => birthdayPosts(loadWorld()))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(world))
  }, [world])

  useEffect(() => {
    applyAccent(world.accent ?? defaultAccent())
  }, [world.accent])

  const api = useMemo(() => {
    const user = world.users.find((u) => u.id === world.currentUserId) ?? world.users[0]
    const rider = user.riderId ? world.riders.find((r) => r.id === user.riderId) : null
    const fan = user.fanId ? world.fans.find((f) => f.id === user.fanId) : null
    const producer = user.producerId ? world.producers.find((p) => p.id === user.producerId) : null
    const topRider = [...world.riders].sort((a, b) => b.points - a.points)[0]
    const isOps = user.role === 'producer'

    function riderById(id) {
      return world.riders.find((r) => r.id === id)
    }
    function horseById(id) {
      return world.horses.find((h) => h.id === id)
    }
    function eventById(id) {
      return world.events.find((e) => e.id === id)
    }
    function fanById(id) {
      return world.fans.find((f) => f.id === id)
    }
    function unpaidFines(riderId) {
      return world.invoices.filter((i) => i.riderId === riderId && i.type === 'fine' && !i.paid)
    }
    function unpaidMembership(riderId) {
      return world.invoices.filter((i) => i.riderId === riderId && i.type === 'membership' && !i.paid)
    }
    function entriesFor(eventId, { paidOnly = false } = {}) {
      return world.entries
        .filter((e) => e.eventId === eventId && (!paidOnly || e.paid))
        .slice()
        .sort((a, b) => (a.drawNo ?? 99) - (b.drawNo ?? 99) || a.id.localeCompare(b.id))
    }
    function resultsFor(eventId) {
      return world.results.filter((r) => r.eventId === eventId)
    }
    function officialStandings() {
      return [...world.riders].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    }
    function horseStandings(division = null) {
      const officialIds = new Set(world.events.filter((e) => e.official).map((e) => e.id))
      const rows = world.results.filter((r) => officialIds.has(r.eventId) && r.time != null && !r.scratch)
      const byHorse = {}
      for (const r of rows) {
        if (division && r.division !== division) continue
        const slot = (byHorse[r.horseId] ??= { horseId: r.horseId, wins: 0, times: [] })
        if (r.place === 1) slot.wins += 1
        slot.times.push(r.time)
      }
      return Object.values(byHorse)
        .map((s) => ({
          ...s,
          horse: horseById(s.horseId),
          avg: s.times.reduce((a, b) => a + b, 0) / s.times.length,
        }))
        .sort((a, b) => b.wins - a.wins || a.avg - b.avg)
    }
    function topSupporters() {
      const map = {}
      for (const f of world.feed.filter((x) => x.type === 'boost')) {
        const id = f.fromFanId || f.fromUserId || 'unknown'
        map[id] = (map[id] ?? 0) + (f.amount ?? 0)
      }
      return Object.entries(map)
        .map(([id, amount]) => ({ id, name: fanById(id)?.name || riderById(id)?.name || id, amount }))
        .sort((a, b) => b.amount - a.amount)
    }

    function switchUser(userId, { reason } = {}) {
      setWorld((w) => {
        const target = w.users.find((u) => u.id === userId)
        const inspecting = userId !== 'admin' && (w.currentUserId === 'admin' || w.viewingFromAdmin)
        return {
          ...w,
          currentUserId: userId,
          viewingFromAdmin: inspecting,
          viewAsLog: inspecting && (w.currentUserId === 'admin' || w.viewingFromAdmin)
            ? [
                { at: new Date().toISOString(), userId, name: target?.name, role: target?.role, reason: reason || 'Support' },
                ...(w.viewAsLog ?? []),
              ].slice(0, 12)
            : w.viewAsLog,
        }
      })
    }
    function demoSwitch(userId) {
      setWorld((w) => ({ ...w, currentUserId: userId, viewingFromAdmin: false }))
    }
    function exitViewAs() {
      setWorld((w) => ({ ...w, currentUserId: 'admin', viewingFromAdmin: false }))
    }
    function resetDemo() {
      const next = birthdayPosts(createSeed())
      next.currentUserId = 'admin'
      setWorld(next)
      toast.success('Season restored on this device')
    }
    function setMembershipIncludesApp(value) {
      setWorld((w) => ({ ...w, membershipIncludesApp: value }))
    }
    function setAppPrice(value) {
      setWorld((w) => ({ ...w, appPrice: Number(value) || 0 }))
    }
    function setAccent(accent, { quiet } = {}) {
      setWorld((w) => ({ ...w, accent }))
      if (!quiet) toast.success(`Season accent · ${accent.name}`)
    }

    function addTx(w, row) {
      return ledger(w, row)
    }

    function payInvoice(invoiceId, { fromWallet } = {}) {
      setWorld((w) => {
        const inv = w.invoices.find((i) => i.id === invoiceId)
        if (!inv || inv.paid) return w
        let next = { ...w }
        if (fromWallet && inv.riderId) {
          const r = next.riders.find((x) => x.id === inv.riderId)
          if (!r || r.wallet < inv.amount) {
            queueMicrotask(() => toast.error('Wallet too low'))
            return w
          }
          next = {
            ...next,
            riders: next.riders.map((x) => (x.id === inv.riderId ? { ...x, wallet: x.wallet - inv.amount } : x)),
          }
          next = addTx(next, { ownerId: inv.riderId, ownerType: 'rider', dir: 'debit', amount: inv.amount, label: inv.label })
        }
        let entries = next.entries
        let results = next.results
        if (inv.entryId) {
          entries = entries.map((e) => (e.id === inv.entryId ? { ...e, paid: true } : e))
          const entry = entries.find((e) => e.id === inv.entryId)
          results = ensureResultForEntry(next, results, entry)
        }
        next = {
          ...next,
          entries,
          results,
          invoices: next.invoices.map((i) => (i.id === invoiceId ? { ...i, paid: true, paidAt: new Date().toISOString() } : i)),
        }
        return next
      })
      toast.success('Paid')
    }

    function issueMembershipInvoice(riderId, { klass } = {}) {
      const r = riderById(riderId)
      const amount = membershipFee(klass || r?.class)
      const invoiceId = `inv-mem-${riderId}-${Date.now()}`
      setWorld((w) => {
        let next = {
          ...w,
          invoices: [
            ...w.invoices,
            {
              id: invoiceId,
              riderId,
              type: 'membership',
              label: `${klass || r?.class || 'Adult'} membership 2026/27`,
              amount,
              paid: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }
        const riderRow = next.riders.find((x) => x.id === riderId)
        if (riderRow?.debitOrder && riderRow.wallet >= amount) {
          next = {
            ...next,
            riders: next.riders.map((x) => (x.id === riderId ? { ...x, wallet: x.wallet - amount } : x)),
            invoices: next.invoices.map((i) => (i.id === invoiceId ? { ...i, paid: true, paidAt: new Date().toISOString() } : i)),
          }
          next = addTx(next, { ownerId: riderId, ownerType: 'rider', dir: 'debit', amount, label: 'Membership auto-renew (debit order)' })
          queueMicrotask(() => toast.success('Membership auto-paid from wallet'))
        }
        return next
      })
      return invoiceId
    }

    function enterEvent({ eventId, riderId, horseId, klass, carryOver, payNow, guest }) {
      const fines = unpaidFines(riderId)
      if (fines.length) {
        toast.error('Unpaid fine blocks this entry')
        return { ok: false, blocked: true }
      }
      const existing = world.entries.find(
        (e) => e.eventId === eventId && e.riderId === riderId && e.horseId === horseId && e.class === klass,
      )
      if (existing) {
        toast('Already entered')
        return { ok: false, existing: true }
      }
      const fee = entryFee(klass, carryOver)
      const entryId = `ent-${eventId}-${riderId}-${Date.now()}`
      const invoiceId = `inv-${entryId}`
      const r = riderById(riderId)
      const dayMember = guest || /day/i.test(r?.membershipNote || '')
      setWorld((w) => {
        const field = w.entries.filter((e) => e.eventId === eventId)
        const entry = {
          id: entryId,
          eventId,
          riderId,
          horseId,
          class: klass,
          carryOver,
          paid: payNow,
          fee,
          drawNo: field.length + 1,
          guest: Boolean(dayMember),
        }
        let results = w.results
        if (payNow) results = ensureResultForEntry(w, results, entry)
        let invoices = [
          ...w.invoices,
          {
            id: invoiceId,
            riderId,
            type: 'entry',
            label: `${eventById(eventId)?.name ?? 'Event'} — ${klass}${carryOver ? ' + carry-over' : ''}`,
            amount: fee,
            paid: payNow,
            paidAt: payNow ? new Date().toISOString() : null,
            createdAt: new Date().toISOString(),
            entryId,
            eventId,
          },
        ]
        if (dayMember && !w.invoices.some((i) => i.riderId === riderId && i.type === 'membership' && !i.paid)) {
          invoices.push({
            id: `inv-mem-day-${entryId}`,
            riderId,
            type: 'membership',
            label: `${klass} membership (day member / guest)`,
            amount: membershipFee(klass),
            paid: false,
            createdAt: new Date().toISOString(),
          })
        }
        let next = { ...w, entries: [...w.entries, entry], results, invoices }
        if (payNow) next = addTx(next, { ownerId: riderId, ownerType: 'rider', dir: 'debit', amount: fee, label: `Entry ${eventById(eventId)?.name}` })
        return next
      })
      toast.success(payNow ? 'Entered and paid — you’re on the draw' : 'Entered — pay to appear on the draw')
      return { ok: true, entryId }
    }

    function markEntryPaid(entryId) {
      setWorld((w) => {
        const entry = w.entries.find((e) => e.id === entryId)
        if (!entry) return w
        const inv = w.invoices.find((i) => i.entryId === entryId)
        let results = ensureResultForEntry(w, w.results, { ...entry, paid: true })
        return {
          ...w,
          entries: w.entries.map((e) => (e.id === entryId ? { ...e, paid: true } : e)),
          results,
          invoices: w.invoices.map((i) => (inv && i.id === inv.id ? { ...i, paid: true, paidAt: new Date().toISOString() } : i)),
        }
      })
      toast.success('Marked paid — on the draw')
    }

    function shuffleDraw(eventId) {
      setWorld((w) => {
        const paid = w.entries.filter((e) => e.eventId === eventId && e.paid)
        const shuffled = [...paid].sort(() => Math.random() - 0.5)
        const order = Object.fromEntries(shuffled.map((e, i) => [e.id, i + 1]))
        return {
          ...w,
          entries: w.entries.map((e) => (order[e.id] ? { ...e, drawNo: order[e.id] } : e)),
        }
      })
      toast.success('Draw shuffled')
    }

    function applyPayoutToMembership(w, riderId, amount) {
      const mem = w.invoices.find((i) => i.riderId === riderId && i.type === 'membership' && !i.paid)
      if (!mem || amount <= 0) return { w, applied: 0, leftover: amount, invoiceId: null }
      const applied = Math.min(mem.amount, amount)
      const leftover = amount - applied
      const paidOff = applied >= mem.amount
      return {
        w: {
          ...w,
          invoices: w.invoices.map((i) =>
            i.id === mem.id
              ? { ...i, amount: mem.amount - applied, paid: paidOff, paidAt: paidOff ? new Date().toISOString() : i.paidAt, appliedFromPayout: applied }
              : i,
          ),
        },
        applied,
        leftover,
        invoiceId: mem.id,
      }
    }

    function makeOfficial(eventId) {
      if (!isOps && user.role !== 'producer') {
        toast.error('Producer marks results official')
        return
      }
      const event = eventById(eventId)
      if (!event || event.official) return
      const prevTop = topRider?.id
      setWorld((w) => {
        const paid = w.entries.filter((e) => e.eventId === eventId && e.paid)
        let results = computeDivisionsAndPlaces(w.results.filter((r) => r.eventId === eventId))
        const others = w.results.filter((r) => r.eventId !== eventId)
        const riders = w.riders.map((r) => ({ ...r }))
        const horses = w.horses.map((h) => ({ ...h }))

        for (const res of results) {
          const entry = paid.find((e) => e.id === res.entryId) ?? w.entries.find((e) => e.id === res.entryId)
          const pts = pointsForResult(res)
          if (res.class === 'Futurity') {
            const horse = horses.find((h) => h.id === res.horseId)
            if (horse) horse.points = (horse.points ?? 0) + pts
            if (entry?.carryOver) {
              const rr = riders.find((r) => r.id === res.riderId)
              if (rr) rr.points += pts
            }
          } else {
            const rr = riders.find((r) => r.id === res.riderId)
            if (rr) rr.points += pts
          }
        }

        const gross = paid.reduce((s, e) => s + e.fee, 0)
        const producing = paid.length * PRODUCING_COST
        const split = splitFees(gross, producing)
        const firsts = results.filter((r) => r.place === 1)
        const seconds = results.filter((r) => r.place === 2)
        const thirds = results.filter((r) => r.place === 3)
        const shares = splitPrize(split.prizePool, firsts, seconds, thirds)
        let next = { ...w, riders, horses }
        const annotated = []
        for (const share of shares) {
          const applied = applyPayoutToMembership(next, share.riderId, share.amount)
          next = applied.w
          const cash = applied.leftover
          next = {
            ...next,
            riders: next.riders.map((r) =>
              r.id === share.riderId ? { ...r, wallet: r.wallet + cash, earnings: r.earnings + share.amount } : r,
            ),
            brsaWallet: (next.brsaWallet ?? 0) + split.brsaAdmin / Math.max(shares.length, 1),
          }
          next = addTx(next, {
            ownerId: share.riderId,
            ownerType: 'rider',
            dir: 'credit',
            amount: share.amount,
            label: `${event.name} payout${applied.applied ? ` · R${applied.applied} to membership` : ''}`,
          })
          annotated.push({ ...share, appliedToMembership: applied.applied, cash, membershipInvoiceId: applied.invoiceId })
        }
        next = { ...next, brsaWallet: Math.round((w.brsaWallet ?? 0) + split.brsaAdmin) }

        const nextTop = [...next.riders].sort((a, b) => b.points - a.points)[0]
        const feed = [
          { id: `feed-official-${eventId}`, type: 'system', at: new Date().toISOString(), text: `${event.name} is official. Points are on the riders.` },
          ...next.feed,
        ]
        if (nextTop && nextTop.id !== prevTop) {
          feed.unshift({
            id: `feed-top-${eventId}`,
            type: 'system',
            at: new Date().toISOString(),
            riderId: nextTop.id,
            text: `${nextTop.name} is the new Top Rider.`,
            to: `/riders/${nextTop.id}`,
          })
          queueMicrotask(() => toast.success(`${nextTop.name} is Top Rider`))
        } else {
          queueMicrotask(() => toast.success(`${event.name} is official`))
        }

        return {
          ...next,
          feed,
          results: [...others, ...results],
          events: next.events.map((e) =>
            e.id === eventId ? { ...e, official: true, status: 'official', officialAt: new Date().toISOString() } : e,
          ),
          payouts: {
            ...next.payouts,
            [eventId]: { eventId, ...split, riderShares: annotated },
          },
        }
      })
    }

    function writeOffMembership(payoutEventId, riderId) {
      setWorld((w) => {
        const receipt = w.payouts[payoutEventId]
        if (!receipt) return w
        const share = receipt.riderShares.find((s) => s.riderId === riderId)
        if (!share?.appliedToMembership) return w
        return {
          ...w,
          riders: w.riders.map((r) => (r.id === riderId ? { ...r, wallet: r.wallet + share.appliedToMembership } : r)),
          invoices: w.invoices.map((i) =>
            i.id === share.membershipInvoiceId ? { ...i, paid: false, paidAt: null, amount: (i.amount || 0) + share.appliedToMembership } : i,
          ),
          payouts: {
            ...w.payouts,
            [payoutEventId]: {
              ...receipt,
              riderShares: receipt.riderShares.map((s) => (s.riderId === riderId ? { ...s, appliedToMembership: 0, cash: s.amount, writtenOff: true } : s)),
            },
          },
        }
      })
      toast.success('Written off — taken as cash')
    }

    function recordTime(resultId, { run, time }) {
      setWorld((w) => {
        const results = w.results.map((r) => {
          if (r.id !== resultId) return r
          const next = { ...r, [run === 2 ? 'run2' : 'run1']: Number(time) }
          const times = [next.run1, next.run2].filter((t) => typeof t === 'number')
          next.time = times.length ? Math.min(...times) : null
          return next
        })
        const eventId = results.find((r) => r.id === resultId)?.eventId
        const recomputed = computeDivisionsAndPlaces(results.filter((r) => r.eventId === eventId))
        const others = results.filter((r) => r.eventId !== eventId)
        return { ...w, results: [...others, ...recomputed] }
      })
    }

    function applyTimesheet(eventId, text) {
      const parsed = parseTimesheet(text)
      if (!parsed.length) {
        toast.error('No times found in that sheet')
        return
      }
      setWorld((w) => {
        let results = w.results.map((r) => ({ ...r }))
        const event = w.events.find((e) => e.id === eventId)
        const runs = event?.runs ?? 1
        for (const row of parsed) {
          const entry = w.entries.find(
            (e) =>
              e.eventId === eventId &&
              (horseById(e.horseId)?.name.toLowerCase() === row.name.toLowerCase() ||
                riderById(e.riderId)?.name.toLowerCase() === row.name.toLowerCase()),
          )
          if (!entry) continue
          let res = results.find((r) => r.entryId === entry.id)
          if (!res) {
            res = {
              id: `res-${entry.id}`,
              entryId: entry.id,
              eventId,
              riderId: entry.riderId,
              horseId: entry.horseId,
              class: entry.class,
              carryOver: entry.carryOver,
              scratch: false,
              run1: null,
              run2: null,
              time: null,
            }
            results.push(res)
          }
          const need = res.run1 == null ? 'run1' : runs > 1 && res.run2 == null ? 'run2' : null
          if (!need) continue
          res[need] = row.time
          const times = [res.run1, res.run2].filter((t) => typeof t === 'number')
          res.time = times.length ? Math.min(...times) : null
        }
        const recomputed = computeDivisionsAndPlaces(results.filter((r) => r.eventId === eventId))
        const others = results.filter((r) => r.eventId !== eventId)
        return { ...w, results: [...others, ...recomputed], events: w.events.map((e) => (e.id === eventId && !e.resultsPostedAt ? { ...e, resultsPostedAt: new Date().toISOString() } : e)) }
      })
      toast.success('Timesheet applied')
    }

    function queryTime(resultId, note) {
      setWorld((w) => ({
        ...w,
        timeQueries: [
          { id: `q-${Date.now()}`, resultId, riderId: rider?.id, note, status: 'open', at: new Date().toISOString() },
          ...(w.timeQueries ?? []),
        ],
      }))
      toast.success('Query sent to the producer')
    }

    function resolveQuery(queryId, status, reply) {
      setWorld((w) => {
        const q = (w.timeQueries ?? []).find((x) => x.id === queryId)
        let results = w.results
        if (status === 'accepted' && q) {
          results = results.map((r) => (r.id === q.resultId ? { ...r, run1: null, run2: null, time: null, place: null, division: null } : r))
        }
        return {
          ...w,
          results,
          timeQueries: (w.timeQueries ?? []).map((x) => (x.id === queryId ? { ...x, status, reply, resolvedAt: new Date().toISOString() } : x)),
        }
      })
      toast.success(status === 'accepted' ? 'Re-opened for re-timing' : `Query ${status}`)
    }

    function boostRider(riderId, amount = 50) {
      if (!fan && !rider) {
        toast.error('Boosts are sent from a supporter or rider account')
        return
      }
      const from = fan ?? rider
      const fromType = fan ? 'fan' : 'rider'
      if (from.wallet < amount) {
        toast.error('Wallet too low')
        return
      }
      setWorld((w) => {
        let next = {
          ...w,
          riders: w.riders.map((r) => (r.id === riderId ? { ...r, wallet: r.wallet + amount } : fromType === 'rider' && r.id === from.id ? { ...r, wallet: r.wallet - amount } : r)),
          fans: fromType === 'fan' ? w.fans.map((f) => (f.id === from.id ? { ...f, wallet: Math.max(0, f.wallet - amount) } : f)) : w.fans,
          feed: [
            {
              id: `feed-boost-${Date.now()}`,
              type: 'boost',
              at: new Date().toISOString(),
              fromFanId: fromType === 'fan' ? from.id : undefined,
              fromUserId: from.id,
              riderId,
              amount,
              text: `${from.name} boosted ${riderById(riderId)?.name ?? 'a rider'} — R${amount}`,
            },
            ...w.feed,
          ],
        }
        next = addTx(next, { ownerId: from.id, ownerType: fromType, dir: 'debit', amount, label: `Boost ${riderById(riderId)?.name}` })
        next = addTx(next, { ownerId: riderId, ownerType: 'rider', dir: 'credit', amount, label: `Boost from ${from.name}` })
        return next
      })
      toast.success(`Boosted ${riderById(riderId)?.name ?? 'rider'}`)
    }

    function payRiderDirect(riderId, amount = 100) {
      setWorld((w) => {
        let next = {
          ...w,
          riders: w.riders.map((r) => (r.id === riderId ? { ...r, wallet: r.wallet + amount, earnings: r.earnings + amount } : r)),
          feed: [
            { id: `feed-gift-${Date.now()}`, type: 'boost', at: new Date().toISOString(), riderId, amount, text: `Direct payment to ${riderById(riderId)?.name} — R${amount}` },
            ...w.feed,
          ],
        }
        next = addTx(next, { ownerId: riderId, ownerType: 'rider', dir: 'credit', amount, label: 'Direct payment' })
        return next
      })
      toast.success('Payment sent')
    }

    function withdrawWallet(amount, owner) {
      const who = owner ?? (rider ? { id: rider.id, type: 'rider' } : fan ? { id: fan.id, type: 'fan' } : null)
      if (!who) return
      setWorld((w) => {
        if (who.type === 'rider') {
          const r = w.riders.find((x) => x.id === who.id)
          if (!r || r.wallet < amount) {
            queueMicrotask(() => toast.error('Wallet too low'))
            return w
          }
          let next = { ...w, riders: w.riders.map((x) => (x.id === who.id ? { ...x, wallet: x.wallet - amount } : x)) }
          next = addTx(next, { ownerId: who.id, ownerType: 'rider', dir: 'debit', amount, label: 'Withdrawal' })
          return next
        }
        const f = w.fans.find((x) => x.id === who.id)
        if (!f || f.wallet < amount) {
          queueMicrotask(() => toast.error('Wallet too low'))
          return w
        }
        let next = { ...w, fans: w.fans.map((x) => (x.id === who.id ? { ...x, wallet: x.wallet - amount } : x)) }
        next = addTx(next, { ownerId: who.id, ownerType: 'fan', dir: 'debit', amount, label: 'Withdrawal' })
        return next
      })
      toast.success('Withdrawal queued')
    }

    function updateBankDetails(details, owner) {
      const who = owner ?? (rider ? { id: rider.id, type: 'rider' } : fan ? { id: fan.id, type: 'fan' } : null)
      if (!who) return
      setWorld((w) =>
        who.type === 'rider'
          ? { ...w, riders: w.riders.map((r) => (r.id === who.id ? { ...r, bank: { ...r.bank, ...details } } : r)) }
          : { ...w, fans: w.fans.map((f) => (f.id === who.id ? { ...f, bank: { ...f.bank, ...details } } : f)) },
      )
      toast.success('Bank details saved')
    }

    function setDebitOrder(value, owner) {
      const who = owner ?? (rider ? { id: rider.id, type: 'rider' } : fan ? { id: fan.id, type: 'fan' } : null)
      if (!who) return
      setWorld((w) =>
        who.type === 'rider'
          ? { ...w, riders: w.riders.map((r) => (r.id === who.id ? { ...r, debitOrder: value } : r)) }
          : { ...w, fans: w.fans.map((f) => (f.id === who.id ? { ...f, debitOrder: value } : f)) },
      )
    }

    function issueFine({ riderId, amount, label }) {
      if (!isOps) {
        toast.error('Producer issues fines')
        return
      }
      setWorld((w) => ({
        ...w,
        invoices: [
          ...w.invoices,
          { id: `inv-fine-${Date.now()}`, riderId, type: 'fine', label, amount: Number(amount), paid: false, createdAt: new Date().toISOString() },
        ],
      }))
      toast.success('Fine issued')
    }

    function adjustPoints(riderId, delta, note) {
      if (!isOps) return
      setWorld((w) => ({
        ...w,
        riders: w.riders.map((r) => (r.id === riderId ? { ...r, points: r.points + Number(delta) } : r)),
        pointAdjustments: [{ id: `adj-${Date.now()}`, riderId, delta: Number(delta), note, at: new Date().toISOString() }, ...(w.pointAdjustments ?? [])],
      }))
      toast.success('Points adjusted')
    }

    function addHofEntry(row) {
      setWorld((w) => ({ ...w, hallOfFame: [{ id: `hof-${Date.now()}`, ...row }, ...w.hallOfFame] }))
      toast.success('Hall of Fame updated')
    }

    function saveEvent(event) {
      if (!isOps) return
      setWorld((w) => {
        const exists = w.events.some((e) => e.id === event.id)
        const events = exists
          ? w.events.map((e) => (e.id === event.id ? { ...e, ...event } : e))
          : [...w.events, { status: 'upcoming', runs: 1, official: false, classes: Object.keys({ Training: 1, Adult: 1, Open: 1, Futurity: 1 }), ...event }]
        return { ...w, events }
      })
      toast.success(event.id ? 'Event saved' : 'Event created')
    }

    function createEvent(partial) {
      const id = `evt-${Date.now()}`
      saveEvent({
        id,
        name: partial.name || 'New event',
        type: partial.type || 'Jackpot',
        region: producer?.region || 'Gauteng',
        venue: partial.venue || 'TBC',
        date: partial.date || new Date().toISOString().slice(0, 10),
        producerId: producer?.id || 'ansie',
        official: false,
        status: 'upcoming',
        runs: Number(partial.runs) || 1,
        resultsPostedAt: null,
        adminFee: 150,
        flyer: partial.flyer || 'BRSA event. Dress code: long sleeve, hat, collar.',
        classes: Object.keys({ Training: 1, Peewee: 1, Junior: 1, Youth: 1, Adult: 1, Senior: 1, Open: 1, Futurity: 1 }),
      })
      return id
    }

    function saveProfile(riderId, patch) {
      setWorld((w) => ({ ...w, riders: w.riders.map((r) => (r.id === riderId ? { ...r, ...patch } : r)) }))
      toast.success('Profile saved')
    }

    function saveHorse(horseId, patch) {
      setWorld((w) => ({ ...w, horses: w.horses.map((h) => (h.id === horseId ? { ...h, ...patch } : h)) }))
      toast.success('Horse saved')
    }

    function registerHorse(riderId, patch) {
      const id = `h-${Date.now()}`
      setWorld((w) => ({ ...w, horses: [...w.horses, { id, riderId, name: patch.name || 'New horse', sex: 'Gelding', age: 6, lte: 0, futurity: false, points: 0, sire: '—', dam: '—', colour: 'Bay', height: '15.0hh', ...patch }] }))
      toast.success('Horse registered')
      return id
    }

    function postCommunity({ text, kind = 'photo', videoUrl, resultId }) {
      const author = rider || fan
      if (!author) return
      setWorld((w) => ({
        ...w,
        community: [
          { id: `com-${Date.now()}`, riderId: rider?.id, fanId: fan?.id, at: new Date().toISOString(), kind, text, videoUrl, resultId, likes: [], comments: [] },
          ...w.community,
        ],
      }))
      toast.success('Posted')
    }

    function likeCommunity(postId) {
      const who = rider?.id || fan?.id
      if (!who) return
      setWorld((w) => ({
        ...w,
        community: w.community.map((p) =>
          p.id === postId
            ? { ...p, likes: (p.likes || []).includes(who) ? p.likes.filter((x) => x !== who) : [...(p.likes || []), who] }
            : p,
        ),
      }))
    }

    function commentCommunity(postId, text) {
      const who = rider?.id || fan?.id
      setWorld((w) => ({
        ...w,
        community: w.community.map((p) =>
          p.id === postId ? { ...p, comments: [...(p.comments || []), { id: `c-${Date.now()}`, riderId: who, text, at: new Date().toISOString() }] } : p,
        ),
      }))
    }

    function toggleFollow(riderId) {
      const who = fan?.id || rider?.id
      if (!who) return
      setWorld((w) => {
        const current = w.follows?.[who] ?? []
        const next = current.includes(riderId) ? current.filter((x) => x !== riderId) : [...current, riderId]
        return { ...w, follows: { ...w.follows, [who]: next } }
      })
    }

    function postNews(text, extra = {}) {
      if (!isOps) return
      setWorld((w) => ({
        ...w,
        feed: [{ id: `feed-${Date.now()}`, type: extra.type || 'system', at: new Date().toISOString(), text, ...extra }, ...w.feed],
      }))
      toast.success('Posted to the feed')
    }

    function upgradeFanToRider(fanId) {
      setWorld((w) => {
        const f = w.fans.find((x) => x.id === fanId)
        if (!f) return w
        const riderId = `r-${fanId}`
        const user = w.users.find((u) => u.fanId === fanId)
        return {
          ...w,
          riders: [
            ...w.riders,
            {
              id: riderId,
              name: f.name,
              sa: 'SA-NEW',
              class: 'Adult',
              province: 'Gauteng',
              points: 0,
              lte: 0,
              earnings: 0,
              wallet: f.wallet,
              membershipNote: 'Day member',
              debitOrder: false,
              bio: f.bio || '',
              sponsors: [],
              photo: f.name.slice(0, 1),
              cover: 'dust',
              bank: f.bank || {},
            },
          ],
          users: w.users.map((u) => (u.id === user?.id ? { ...u, role: 'rider', riderId, fanId: undefined } : u)),
          currentUserId: user?.id || w.currentUserId,
        }
      })
      toast.success('Upgraded to rider')
    }

    return {
      world,
      user,
      rider,
      fan,
      producer,
      isOps,
      viewingFromAdmin: Boolean(world.viewingFromAdmin),
      topRider,
      riderById,
      horseById,
      eventById,
      fanById,
      unpaidFines,
      unpaidMembership,
      entriesFor,
      resultsFor,
      officialStandings,
      horseStandings,
      topSupporters,
      estimateEventPayout: (eventId) => estimatePayout(world.entries.filter((e) => e.eventId === eventId && e.paid)),
      switchUser,
      demoSwitch,
      exitViewAs,
      resetDemo,
      setMembershipIncludesApp,
      setAppPrice,
      setAccent,
      payInvoice,
      issueMembershipInvoice,
      enterEvent,
      markEntryPaid,
      shuffleDraw,
      makeOfficial,
      writeOffMembership,
      recordTime,
      applyTimesheet,
      queryTime,
      resolveQuery,
      boostRider,
      payRiderDirect,
      withdrawWallet,
      updateBankDetails,
      setDebitOrder,
      issueFine,
      adjustPoints,
      addHofEntry,
      saveEvent,
      createEvent,
      saveProfile,
      saveHorse,
      registerHorse,
      postCommunity,
      likeCommunity,
      commentCommunity,
      toggleFollow,
      postNews,
      upgradeFanToRider,
    }
  }, [world])

  return <DemoContext.Provider value={api}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider')
  return ctx
}

function ensureResultForEntry(world, results, entry) {
  if (!entry || results.some((r) => r.entryId === entry.id)) return results
  if (entry.riderId === 'sunny' && entry.eventId === 'west-fest') {
    return [
      ...results,
      {
        id: `res-${entry.id}`,
        entryId: entry.id,
        eventId: entry.eventId,
        riderId: 'sunny',
        horseId: entry.horseId,
        class: entry.class,
        division: '1D',
        place: 1,
        time: 16.421,
        run1: 16.421,
        run2: 16.88,
        carryOver: entry.carryOver,
        scratch: false,
      },
    ]
  }
  return [
    ...results,
    {
      id: `res-${entry.id}`,
      entryId: entry.id,
      eventId: entry.eventId,
      riderId: entry.riderId,
      horseId: entry.horseId,
      class: entry.class,
      run1: null,
      run2: null,
      time: null,
      carryOver: entry.carryOver,
      scratch: false,
    },
  ]
}

function splitPrize(prizePool, firsts, seconds, thirds) {
  if (prizePool <= 0) return []
  const buckets = [
    { rows: firsts, weight: 0.5 },
    { rows: seconds, weight: 0.3 },
    { rows: thirds, weight: 0.2 },
  ]
  const shares = []
  for (const bucket of buckets) {
    if (!bucket.rows.length) continue
    const pot = Math.round(prizePool * bucket.weight)
    const each = Math.floor(pot / bucket.rows.length)
    for (const row of bucket.rows) shares.push({ riderId: row.riderId, amount: each })
  }
  return shares
}
