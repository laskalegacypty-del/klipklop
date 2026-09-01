import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Home,
  Landmark,
  Newspaper,
  Receipt,
  RotateCcw,
  Search,
  Shield,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { useDemo } from '../demo/store'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

export function Shell() {
  const { world, user, rider, switchUser, resetDemo } = useDemo()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    const riders = world.riders
      .filter((r) => r.name.toLowerCase().includes(query) || r.sa.toLowerCase().includes(query))
      .map((r) => ({ type: 'Rider', label: r.name, to: `/riders/${r.id}` }))
    const events = world.events
      .filter((e) => e.name.toLowerCase().includes(query))
      .map((e) => ({ type: 'Event', label: e.name, to: `/events/${e.id}` }))
    return [...riders, ...events].slice(0, 6)
  }, [q, world.events, world.riders])

  const nav = [
    { to: '/', label: 'Home', icon: Home, show: true },
    { to: '/events', label: 'Events', icon: CalendarDays, show: true },
    { to: '/standings', label: 'Standings', icon: Trophy, show: true },
    { to: '/feed', label: 'Feed', icon: Newspaper, show: true },
    { to: '/community', label: 'Community', icon: Users, show: user.role !== 'admin' },
    { to: '/wallet', label: 'Wallet', icon: Wallet, show: user.role === 'rider' || user.role === 'fan' },
    { to: '/invoices', label: 'Invoices', icon: Receipt, show: user.role === 'rider' || user.role === 'admin' },
    { to: '/hof', label: 'Hall of Fame', icon: Landmark, show: true },
    { to: '/rules', label: 'Rules', icon: BookOpen, show: true },
    { to: '/admin', label: 'Admin', icon: Shield, show: user.role === 'admin' },
    { to: '/producer', label: 'Producer', icon: CalendarDays, show: user.role === 'producer' },
  ].filter((item) => item.show)

  return (
    <div className="min-h-screen bg-dust-100">
      <header className="sticky top-0 z-40 border-b border-stone-800 bg-charcoal text-brand-50">
        <div className="container-page flex flex-wrap items-center gap-3 py-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-display text-sm font-bold text-white">
              BR
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-bold tracking-tight">BRSA</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-brand-200">Barrel Racing SA</p>
            </div>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto pb-1 sm:order-2 sm:w-auto sm:flex-1 sm:justify-center sm:pb-0">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative ml-auto order-2 sm:order-3">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search riders, events"
              className="h-9 w-40 pl-8 bg-white/5 border-white/10 text-white placeholder:text-stone-400 sm:w-56"
            />
            {hits.length > 0 && (
              <div className="absolute right-0 mt-1 w-64 rounded-xl border border-dust-200 bg-white py-1 text-charcoal shadow-lg">
                {hits.map((hit) => (
                  <button
                    key={hit.to}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-dust-50"
                    onClick={() => {
                      navigate(hit.to)
                      setQ('')
                    }}
                  >
                    <span>{hit.label}</span>
                    <span className="text-xs text-stone-400">{hit.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-brand-200 bg-brand-50">
        <div className="container-page flex flex-wrap items-center gap-2 py-2 text-sm">
          <Badge variant="charcoal">Demo seat</Badge>
          <select
            value={user.id}
            onChange={(e) => switchUser(e.target.value)}
            className="h-9 rounded-lg border border-brand-200 bg-white px-2 text-sm font-semibold text-charcoal"
          >
            {world.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role} ({u.username}/demo)
              </option>
            ))}
          </select>
          {rider ? (
            <Link to={`/riders/${rider.id}`} className="text-brand-800 hover:underline">
              {rider.membershipNote}
            </Link>
          ) : null}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={resetDemo}>
            <RotateCcw size={14} />
            Reset demo
          </Button>
        </div>
      </div>

      <main className="container-page py-6 pb-16">
        <Outlet />
      </main>
      <footer className="border-t border-dust-200 bg-white/70">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-stone-500">
          <p>Pitch demo · not live BRSA · not KlipKlop</p>
          <p>
            WhatsApp desk 082 000 0000 ·{' '}
            <a className="underline" href="https://www.instagram.com" target="_blank" rel="noreferrer">
              Instagram
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
