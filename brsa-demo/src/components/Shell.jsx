import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Home,
  Landmark,
  Menu,
  Newspaper,
  Receipt,
  Search,
  Shield,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useDemo } from '../demo/store'
import { roleLabel } from '../demo/world'
import { AccountMenu } from './AccountMenu'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

export function Shell() {
  const { world, user, rider, viewingFromAdmin, exitViewAs } = useDemo()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return null
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

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function goAdminDesk() {
    exitViewAs()
    navigate('/admin')
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-dust-100">
      <header className="sticky top-0 z-40 bg-charcoal text-brand-50">
        <div className="h-[3px] bg-brand-400" />
        <div className="h-[3px] bg-season" />
        <div className="container-page">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-brand-400 font-display text-base font-bold text-charcoal">
                BR
              </span>
              <div className="leading-tight">
                <p className="font-display text-xl font-semibold tracking-wide text-white">BRSA</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-300">Barrel Racing SA</p>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative hidden sm:block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search riders, events"
                  className="h-9 w-44 pl-8 bg-white/5 border-white/10 text-white placeholder:text-stone-500 lg:w-56"
                />
                {hits && (
                  <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-dust-200 bg-white py-1 text-charcoal shadow-lg">
                    {hits.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-stone-500">No matches</p>
                    ) : (
                      hits.map((hit) => (
                        <button
                          key={hit.to}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
                          onClick={() => {
                            navigate(hit.to)
                            setQ('')
                          }}
                        >
                          <span>{hit.label}</span>
                          <span className="text-xs uppercase tracking-wide text-stone-400">{hit.type}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <AccountMenu />
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 text-white lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>

          <nav className="hidden flex-wrap justify-center gap-x-0.5 border-t border-white/10 py-1 lg:flex">
            {nav.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>

        {viewingFromAdmin ? (
          <div className="bg-season text-season-ink">
            <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <p>
                <span className="font-semibold">Viewing as {user.name}</span>
                <span className="opacity-80">
                  {' '}
                  · {roleLabel(user.role)}
                  {rider ? ` · ${rider.sa}` : ''} — entries and payments apply to this member.
                </span>
              </p>
              <Button size="sm" variant="charcoal" onClick={goAdminDesk}>
                Stop viewing as
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-[min(20.5rem,92vw)] flex-col bg-charcoal text-white shadow-2xl">
            <div className="h-[3px] bg-brand-400" />
            <div className="h-[3px] bg-season" />
            <div className="flex items-center justify-between px-4 py-4">
              <p className="font-display text-lg">Menu</p>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search riders, events"
                  className="h-10 pl-8 bg-white/5 border-white/10 text-white placeholder:text-stone-500"
                />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-6">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-sm px-3 py-3 text-sm font-medium ${
                      isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {viewingFromAdmin ? (
              <div className="border-t border-white/10 p-4">
                <Button className="w-full" variant="secondary" onClick={goAdminDesk}>
                  Stop viewing as {user.name.split(' ')[0]}
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      <main className="container-page py-6 pb-16">
        <Outlet />
      </main>
      <footer className="border-t border-dust-200 bg-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-xs tracking-wide text-stone-500">
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-season" />
            Barrel Racing South Africa · {world.season}
          </p>
          <p>
            <a className="text-charcoal underline decoration-[color:var(--season)] underline-offset-4" href="https://www.instagram.com" target="_blank" rel="noreferrer">
              Instagram
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

function NavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `relative flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium ${
          isActive
            ? 'bg-white/10 text-white after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-0.5 after:bg-season'
            : 'text-stone-400 hover:bg-white/5 hover:text-brand-100'
        }`
      }
    >
      <item.icon size={15} />
      {item.label}
    </NavLink>
  )
}
