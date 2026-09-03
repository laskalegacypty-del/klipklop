import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { entryFee, pointsForResult, PRODUCING_COST } from './money'
import { createSeed } from './world'
import { applyAccent, defaultAccent } from './accents'

const STORAGE_KEY = 'brsa-pitch-v1'
const DemoContext = createContext(null)

function loadWorld() {
  const seed = createSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === 1) {
        return {
          ...seed,
          ...parsed,
          accent: parsed.accent ?? seed.accent,
          viewingFromAdmin: parsed.viewingFromAdmin ?? false,
          viewAsLog: parsed.viewAsLog ?? [],
        }
      }
    }
  } catch {
    /* fall through */
  }
  return seed
}

export function DemoProvider({ children }) {
  const [world, setWorld] = useState(loadWorld)

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

    function riderById(id) {
      return world.riders.find((r) => r.id === id)
    }
    function horseById(id) {
      return world.horses.find((h) => h.id === id)
    }
    function eventById(id) {
      return world.events.find((e) => e.id === id)
    }

    function unpaidFines(riderId) {
      return world.invoices.filter((i) => i.riderId === riderId && i.type === 'fine' && !i.paid)
    }

    function entriesFor(eventId, { paidOnly = false } = {}) {
      return world.entries.filter((e) => e.eventId === eventId && (!paidOnly || e.paid))
    }

    function resultsFor(eventId) {
      return world.results.filter((r) => r.eventId === eventId)
    }

    function officialStandings() {
      return [...world.riders].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    }

    function switchUser(userId, { reason } = {}) {
      setWorld((w) => {
        const target = w.users.find((u) => u.id === userId)
        const inspecting = userId !== 'admin' && (w.currentUserId === 'admin' || w.viewingFromAdmin)
        return {
          ...w,
          currentUserId: userId,
          viewingFromAdmin: inspecting,
          viewAsLog: inspecting
            ? [
                {
                  at: new Date().toISOString(),
                  userId,
                  name: target?.name,
                  role: target?.role,
                  reason: reason || 'Support',
                },
                ...(w.viewAsLog ?? []),
              ].slice(0, 12)
            : w.viewAsLog,
        }
      })
    }

    function exitViewAs() {
      setWorld((w) => ({ ...w, currentUserId: 'admin', viewingFromAdmin: false }))
    }

    function resetDemo() {
      const next = createSeed()
      next.currentUserId = 'admin'
      setWorld(next)
      toast.success('Season restored on this device')
    }

    function setMembershipIncludesApp(value) {
      setWorld((w) => ({ ...w, membershipIncludesApp: value }))
    }

    function setAccent(accent, { quiet } = {}) {
      setWorld((w) => ({ ...w, accent }))
      if (!quiet) toast.success(`Season accent · ${accent.name}`)
    }

    function payInvoice(invoiceId) {
      setWorld((w) => {
        const inv = w.invoices.find((i) => i.id === invoiceId)
        if (!inv || inv.paid) return w
        let entries = w.entries
        let results = w.results
        if (inv.entryId) {
          entries = entries.map((e) => (e.id === inv.entryId ? { ...e, paid: true } : e))
          const entry = entries.find((e) => e.id === inv.entryId)
          results = ensureResultForEntry(w, results, entry)
        }
        return {
          ...w,
          entries,
          results,
          invoices: w.invoices.map((i) =>
            i.id === invoiceId ? { ...i, paid: true, paidAt: new Date().toISOString() } : i,
          ),
        }
      })
      toast.success('Paid')
    }

    function enterEvent({ eventId, riderId, horseId, klass, carryOver, payNow }) {
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
      setWorld((w) => {
        const entry = {
          id: entryId,
          eventId,
          riderId,
          horseId,
          class: klass,
          carryOver,
          paid: payNow,
          fee,
        }
        let results = w.results
        if (payNow) results = ensureResultForEntry(w, results, entry)
        return {
          ...w,
          entries: [...w.entries, entry],
          results,
          invoices: [
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
          ],
        }
      })
      toast.success(payNow ? 'Entered and paid — you’re on the draw' : 'Entered — pay to appear on the draw')
      return { ok: true, entryId }
    }

    function makeOfficial(eventId) {
      const event = eventById(eventId)
      if (!event || event.official) return
      const prevTop = topRider?.id
      setWorld((w) => {
        const paid = w.entries.filter((e) => e.eventId === eventId && e.paid)
        const results = w.results.filter((r) => r.eventId === eventId)
        const riders = w.riders.map((r) => ({ ...r }))
        const horses = w.horses.map((h) => ({ ...h }))

        for (const res of results) {
          const entry = paid.find((e) => e.id === res.entryId) ?? w.entries.find((e) => e.id === res.entryId)
          const pts = pointsForResult(res, entry)
          if (res.class === 'Futurity') {
            const horse = horses.find((h) => h.id === res.horseId)
            if (horse) horse.points = (horse.points ?? 0) + pts
            if (entry?.carryOver) {
              const rider = riders.find((r) => r.id === res.riderId)
              if (rider) rider.points += 5
            }
          } else {
            const rider = riders.find((r) => r.id === res.riderId)
            if (rider) rider.points += pts
          }
        }

        const gross = paid.reduce((s, e) => s + e.fee, 0)
        const producing = paid.length * PRODUCING_COST
        const remaining = Math.max(0, gross - producing)
        const prizePool = Math.round(remaining * 0.7)
        const brsaAdmin = remaining - prizePool
        const firsts = results.filter((r) => r.place === 1)
        const seconds = results.filter((r) => r.place === 2)
        const thirds = results.filter((r) => r.place === 3)
        const shares = splitPrize(prizePool, firsts, seconds, thirds)
        for (const share of shares) {
          const rider = riders.find((r) => r.id === share.riderId)
          if (rider) {
            rider.wallet += share.amount
            rider.earnings += share.amount
          }
        }

        const nextTop = [...riders].sort((a, b) => b.points - a.points)[0]
        const feed = [
          {
            id: `feed-official-${eventId}`,
            type: 'system',
            at: new Date().toISOString(),
            text: `${event.name} is official. Points are on the riders.`,
          },
          ...w.feed,
        ]
        if (nextTop && nextTop.id !== prevTop) {
          feed.unshift({
            id: `feed-top-${eventId}`,
            type: 'system',
            at: new Date().toISOString(),
            text: `${nextTop.name} is the new Top Rider.`,
          })
          queueMicrotask(() => toast.success(`${nextTop.name} is Top Rider`))
        } else {
          queueMicrotask(() => toast.success(`${event.name} is official`))
        }

        return {
          ...w,
          riders,
          horses,
          feed,
          events: w.events.map((e) =>
            e.id === eventId ? { ...e, official: true, officialAt: new Date().toISOString() } : e,
          ),
          payouts: {
            ...w.payouts,
            [eventId]: {
              eventId,
              producing,
              prizePool,
              brsaAdmin,
              groundLevy: producing,
              riderShares: shares,
            },
          },
        }
      })
    }

    function boostRider(riderId, amount = 50) {
      if (!fan) {
        toast.error('Boosts are sent from a supporter account')
        return
      }
      setWorld((w) => ({
        ...w,
        riders: w.riders.map((r) => (r.id === riderId ? { ...r, wallet: r.wallet + amount } : r)),
        fans: w.fans.map((f) => (f.id === fan.id ? { ...f, wallet: Math.max(0, f.wallet - amount) } : f)),
        feed: [
          {
            id: `feed-boost-${Date.now()}`,
            type: 'boost',
            at: new Date().toISOString(),
            fromFanId: fan.id,
            riderId,
            amount,
            text: `${fan.name} boosted ${riderById(riderId)?.name ?? 'a rider'} — R${amount}`,
          },
          ...w.feed,
        ],
      }))
      toast.success(`Boosted ${riderById(riderId)?.name ?? 'rider'}`)
    }

    return {
      world,
      user,
      rider,
      fan,
      producer,
      viewingFromAdmin: Boolean(world.viewingFromAdmin),
      topRider,
      riderById,
      horseById,
      eventById,
      unpaidFines,
      entriesFor,
      resultsFor,
      officialStandings,
      switchUser,
      exitViewAs,
      resetDemo,
      setMembershipIncludesApp,
      setAccent,
      payInvoice,
      enterEvent,
      makeOfficial,
      boostRider,
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
        carryOver: entry.carryOver,
      },
    ]
  }
  return results
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
    for (const row of bucket.rows) {
      shares.push({ riderId: row.riderId, amount: each })
    }
  }
  return shares
}
