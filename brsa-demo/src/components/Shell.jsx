import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Clock,
  Home,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Newspaper,
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
  const { world, user, rider, viewingFromAdmin, exitViewAs, demoSwitch } = useDemo()
  const navigate = useNavigate()
  const location = useLocation()
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return null
    const riders = world.riders
      .filter((r) => r.name.toLowerCase().includes(query) || r.sa.toLowerCase().includes(query))
      .map((r) => ({ type: 'Rider', label: r.name, to: `/riders/${r.id}` }))
    const horses = world.horses
      .filter((h) => h.name.toLowerCase().includes(query))
      .map((h) => ({ type: 'Horse', label: h.name, to: `/horses/${h.id}` }))
    const events = world.events
      .filter((e) => e.name.toLowerCase().includes(query))
      .map((e) => ({ type: 'Event', label: e.name, to: `/events/${e.id}` }))
    return [...riders, ...horses, ...events].slice(0, 8)
  }, [q, world.events, world.horses, world.riders])

  const nav = [
    { to: '/', label: 'Home', icon: Home, show: true, end: true, dock: user.role !== 'rider' },
    { to: '/dashboard', label: 'My season', icon: LayoutDashboard, show: user.role === 'rider', dock: user.role === 'rider' },
    { to: '/events', label: 'Events', icon: CalendarDays, show: true, dock: true },
    { to: '/standings', label: 'Standings', icon: Trophy, show: true, dock: user.role === 'admin' },
    { to: '/feed', label: 'News', icon: Newspaper, show: true },
    { to: '/community', label: 'Yard', icon: Users, show: user.role !== 'admin', dock: user.role === 'fan' },
    { to: '/wallet', label: 'Money', icon: Wallet, show: user.role === 'rider' || user.role === 'fan' || user.role === 'producer', dock: user.role === 'rider' || user.role === 'fan' || user.role === 'producer' },
    { to: '/times', label: 'My times', icon: Clock, show: user.role === 'rider' || user.role === 'producer', dock: user.role === 'rider' },
    { to: '/hof', label: 'Hall of Fame', icon: Landmark, show: true },
    { to: '/rules', label: 'Rules', icon: BookOpen, show: true },
    { to: '/barry', label: 'Barry', icon: MessageCircle, show: true },
    { to: '/producer', label: 'Show office', icon: CalendarDays, show: user.role === 'producer', dock: user.role === 'producer' },
    { to: '/admin', label: 'Help a member', icon: Shield, show: user.role === 'admin', dock: user.role === 'admin' },
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

  const links = (
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium ${
              isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'
            }`
          }
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-dust-100">
      <header className="sticky top-0 z-40 bg-charcoal text-brand-50">
        <div className="h-[3px] bg-brand-400" />
        <div className="h-[3px] bg-season" />
        <div className="flex items-center justify-between gap-3 px-3 py-3 lg:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/brsa-logo-white.png" alt="BRSA" className="h-10 w-10 rounded-sm" />
              <div className="leading-tight">
                <p className="font-display text-xl font-semibold tracking-wide text-white">BRSA</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-300">Barrel Racing SA</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {location.pathname !== '/' ? (
              <button
                type="button"
                className="hidden items-center gap-1 rounded-sm px-2 py-1 text-sm text-stone-300 hover:text-white sm:flex"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : null}
            <div className="relative hidden sm:block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a rider, horse or show"
                className="h-9 w-48 bg-white/5 pl-8 text-white placeholder:text-stone-500 lg:w-64 border-white/10"
              />
              {hits && (
                <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-dust-200 bg-white py-1 text-charcoal shadow-lg">
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
            <label className="hidden items-center gap-2 text-xs text-stone-400 lg:flex">
              Looking as
              <select
                className="max-w-[11rem] rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                value={viewingFromAdmin ? 'viewas' : user.id}
                onChange={(e) => {
                  if (e.target.value === 'viewas') return
                  demoSwitch(e.target.value)
                }}
              >
                {world.users.map((u) => (
                  <option key={u.id} value={u.id} className="text-charcoal">
                    {u.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </label>
            <AccountMenu />
          </div>
        </div>
        {viewingFromAdmin ? (
          <div className="bg-season text-season-ink">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <p>
                <span className="font-semibold">Viewing as {user.name}</span>
                <span className="opacity-80">
                  {' '}
                  · {roleLabel(user.role)}
                  {rider ? ` · ${rider.sa}` : ''} — you are paying and entering as them.
                </span>
              </p>
              <Button size="sm" variant="charcoal" onClick={goAdminDesk}>
                Back to help desk
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[min(20.5rem,92vw)] flex-col bg-charcoal text-white shadow-2xl">
            <div className="h-[3px] bg-brand-400" />
            <div className="h-[3px] bg-season" />
            <div className="flex items-center justify-between px-4 py-4">
              <p className="font-display text-lg">Menu</p>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="px-3 pb-6">{links}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex">
        <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-56 shrink-0 bg-charcoal text-white lg:block">
          <div className="px-2 py-4">{links}</div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-16">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-charcoal text-white lg:hidden">
        <div className="grid grid-cols-4">
          {nav
            .filter((item) => item.dock)
            .slice(0, 4)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-300' : 'text-stone-300'}`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
        </div>
      </nav>
    </div>
  )
}
