import { useState, useEffect, useRef, createElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import {
  Home,
  Calendar,
  Clock,
  BarChart2,
  Bell,
  Menu,
  Shield,
  Users,
  Settings,
  HeartPulse,
  Table2,
  UserSearch,
  UsersRound,
  Trophy,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  History,
} from 'lucide-react'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE_SIDEBAR } from '../../constants/branding'
import OnboardingTour from '../onboarding/OnboardingTour'
import { START_TUTORIAL_EVENT } from '../onboarding/OnboardingTour'
import NationalsCountdown from './NationalsCountdown'

const APP_TAGLINE_ADMIN = 'Admin Panel'

const userNavItems = [
  { path: '/dashboard',           label: 'Home',              icon: Home,          group: null },
  { path: '/qualifiers',          label: 'Qualifiers',        icon: Calendar,      group: 'compete' },
  { path: '/matrix',              label: 'Matrix',            icon: Table2,        group: 'compete' },
  { path: '/my-times',            label: 'My Times',          icon: Clock,         group: 'compete' },
  { path: '/tracker',             label: 'Qualifier Tracker', icon: BarChart2,     group: 'compete' },
  { path: '/event-day',           label: 'Event Day',         icon: ClipboardList, group: 'compete' },
  { path: '/season',              label: 'Season Overview',   icon: BarChart2,     group: 'compete' },
  { path: '/horses',              label: 'Horses',            icon: HeartPulse,    group: 'stable' },
  { path: '/friends-leaderboard', label: 'Rankings',          icon: Trophy,        group: 'stable' },
  { path: '/assistant',           label: 'Assistant',         icon: MessageCircle, group: 'tools' },
  { path: '/notifications',       label: 'Notifications',     icon: Bell,          group: 'tools' },
]

const supporterNavItems = [
  { path: '/dashboard',     label: 'Home',          icon: Home,          group: null },
  { path: '/qualifiers',    label: 'Qualifiers',    icon: Calendar,      group: 'compete' },
  { path: '/matrix',        label: 'Matrix',        icon: Table2,        group: 'compete' },
  { path: '/event-day',         label: 'Event Day',     icon: ClipboardList, group: 'compete' },
  { path: '/my-riders',     label: 'My Riders',     icon: UserSearch,    group: 'stable' },
  { path: '/assistant',        label: 'Assistant',       icon: MessageCircle, group: 'tools' },
  { path: '/notifications',    label: 'Notifications',   icon: Bell,          group: 'tools' },
]

const clubHeadNavItems = [
  { path: '/dashboard',        label: 'Home',              icon: Home,          group: null },
  { path: '/qualifiers',       label: 'Qualifiers',        icon: Calendar,      group: 'season' },
  { path: '/matrix',           label: 'Matrix',            icon: Table2,        group: 'season' },
  { path: '/my-club-riders',   label: 'My Riders',         icon: UsersRound,    group: 'season' },
  { path: '/tracker',          label: 'Qualifier Tracker', icon: BarChart2,     group: 'season' },
  { path: '/event-day',         label: 'Event Day',         icon: ClipboardList, group: 'season' },
  { path: '/my-times',         label: 'My Times',          icon: Clock,         group: 'season' },
  { path: '/season',           label: 'Season Overview',   icon: BarChart2,     group: 'season' },
  { path: '/horses',           label: 'Horses',            icon: HeartPulse,    group: 'stable' },
  { path: '/assistant',        label: 'Assistant',         icon: MessageCircle, group: 'tools' },
  { path: '/notifications',    label: 'Notifications',     icon: Bell,          group: 'tools' },
]

const clubMemberNavItems = [
  { path: '/dashboard',     label: 'Home',          icon: Home,          group: null },
  { path: '/qualifiers',    label: 'Qualifiers',    icon: Calendar,      group: 'compete' },
  { path: '/matrix',        label: 'Matrix',        icon: Table2,        group: 'compete' },
  { path: '/my-times',      label: 'My Times',      icon: Clock,         group: 'compete' },
  { path: '/event-day',         label: 'Event Day',     icon: ClipboardList, group: 'compete' },
  { path: '/assistant',        label: 'Assistant',       icon: MessageCircle, group: 'tools' },
  { path: '/notifications',    label: 'Notifications',   icon: Bell,          group: 'tools' },
]

const adminNavItems = [
  { path: '/admin/dashboard', label: 'Dashboard',              icon: Home,          group: null },
  { path: '/admin/users',     label: 'Users',                  icon: Users,         group: 'manage' },
  { path: '/admin/events',    label: 'Events',                 icon: Calendar,      group: 'manage' },
  { path: '/admin/matrix',    label: 'Matrix & Announcements', icon: Settings,      group: 'manage' },
  { path: '/assistant',       label: 'Assistant',              icon: MessageCircle, group: 'tools' },
]

const GROUP_LABELS = {
  compete: 'Competing',
  season:  'Season',
  stable:  'My Stable',
  tools:   'Tools',
  manage:  'Manage',
}

function getRoleLabel(profile, isAdmin, isSupporter, isClubHead, isClubMember) {
  if (isAdmin)     return 'Admin'
  if (isSupporter) return 'Supporter'
  if (isClubHead)  return 'Club Head'
  if (isClubMember) return 'Club Member'
  return 'Rider'
}

export default function Layout({ children }) {
  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const [unreadCount, setUnreadCount] = useState(0)
  const { profile, isAdmin, isSupporter, isClubHead, isClubMember } = useAuth()
  const location = useLocation()
  const mainRef  = useRef(null)

  const navItems = isAdmin
    ? adminNavItems
    : isSupporter
    ? supporterNavItems
    : isClubHead
    ? clubHeadNavItems
    : isClubMember
    ? clubMemberNavItems
    : userNavItems

  // Current page label for mobile header
  const currentPageLabel = navItems.find(item => item.path === location.pathname)?.label ?? ''

  const roleLabel = getRoleLabel(profile, isAdmin, isSupporter, isClubHead, isClubMember)

  function toggleCollapsed() {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  async function fetchUnreadCount() {
    if (!profile?.id) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }

  useEffect(() => {
    if (profile?.id && !isAdmin) fetchUnreadCount()
    if (isAdmin) setUnreadCount(0)
  }, [profile, isAdmin, isSupporter, isClubHead, isClubMember])

  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sidebarOpen])

  useEffect(() => {
    const scrollEl = mainRef.current
    if (!scrollEl) return
    const key = `layout_scroll:${location.pathname}${location.search}`
    const saved = sessionStorage.getItem(key)
    if (saved) scrollEl.scrollTop = Number(saved)
    const onScroll = () => sessionStorage.setItem(key, String(scrollEl.scrollTop))
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [location.pathname, location.search])

  function handleReplayTutorial() {
    window.dispatchEvent(new CustomEvent(START_TUTORIAL_EVENT))
    setSidebarOpen(false)
  }

  const col = sidebarCollapsed // shorthand

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className={`
        fixed top-0 left-0 h-full bg-green-900 text-white z-30 flex flex-col
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        w-72 max-w-[85vw]
        lg:translate-x-0 lg:static lg:z-auto
        ${col ? 'lg:w-16' : 'lg:w-64'}
      `}>

        {/* Logo */}
        <div className={`border-b border-white/10 flex-shrink-0 ${col ? 'lg:p-3 lg:flex lg:justify-center' : 'p-5'}`}>
          <Link
            to={isAdmin ? '/admin/dashboard' : '/dashboard'}
            className={`flex items-center gap-3 ${col ? 'lg:justify-center' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <img
              src={APP_LOGO_SRC}
              alt={`${APP_NAME} logo`}
              className="h-10 w-10 rounded-xl bg-white/10 p-1 object-contain flex-shrink-0"
            />
            <div className={`min-w-0 ${col ? 'lg:hidden' : ''}`}>
              <h1 className="text-base font-bold leading-tight truncate">{APP_NAME}</h1>
              <p className="text-white/70 text-xs mt-0.5 truncate">
                {isAdmin ? APP_TAGLINE_ADMIN : APP_TAGLINE_SIDEBAR}
              </p>
            </div>
          </Link>
        </div>

        {/* Nav items — scrollable middle section */}
        <nav className={`flex-1 overflow-y-auto py-4 ${col ? 'lg:px-2' : 'px-4'}`}>
          <ul className="space-y-0.5">
            {(() => {
              let lastGroup = undefined
              return navItems.map(({ path, label, icon, group }) => {
                const isActive  = location.pathname === path
                const showBadge = path === '/notifications' && unreadCount > 0
                const showDivider = group !== null && group !== lastGroup
                lastGroup = group

                return (
                  <li key={path}>
                    {showDivider && (
                      <div className={`border-t border-white/10 mt-3 pt-3 ${col ? 'lg:hidden' : ''}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-4 pb-1">
                          {GROUP_LABELS[group]}
                        </p>
                      </div>
                    )}
                    {/* Collapsed: just a divider line, no label */}
                    {showDivider && col && (
                      <div className="hidden lg:block border-t border-white/10 mt-2 mb-2" />
                    )}
                    <Link
                      to={path}
                      onClick={() => setSidebarOpen(false)}
                      title={col ? label : undefined}
                      className={`
                        relative flex items-center gap-3 py-2.5 rounded-lg transition
                        ${col ? 'lg:justify-center lg:px-0' : 'px-4'}
                        ${isActive
                          ? col
                            ? 'bg-white/20 text-white font-semibold lg:rounded-lg'
                            : 'bg-white/20 text-white font-semibold before:absolute before:left-0 before:inset-y-1.5 before:w-0.5 before:rounded-full before:bg-green-300'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      {createElement(icon, { size: 20 })}
                      <span className={`text-sm flex-1 ${col ? 'lg:hidden' : ''}`}>{label}</span>
                      {showBadge && (
                        <span className={`bg-yellow-400 text-yellow-950 text-xs font-bold rounded-full min-w-5 text-center
                          ${col ? 'lg:absolute lg:top-1 lg:right-1 lg:min-w-4 lg:h-4 lg:px-0.5 lg:text-[9px]' : 'px-1.5 py-0.5'}`}>
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })
            })()}
          </ul>

          {!isAdmin && (
            <Link
              to="/getting-started"
              onClick={() => setSidebarOpen(false)}
              title={col ? 'Getting Started' : undefined}
              className={`mt-3 w-full flex items-center gap-3 py-2.5 rounded-lg transition text-white/80 hover:bg-white/10 hover:text-white
                ${col ? 'lg:justify-center lg:px-0' : 'px-4'}`}
            >
              <Settings size={20} />
              <span className={`text-sm font-medium ${col ? 'lg:hidden' : ''}`}>Getting Started</span>
            </Link>
          )}
        </nav>

        {/* ── Profile footer ────────────────────────────────────────── */}
        <div className={`flex-shrink-0 border-t border-white/10 ${col ? 'lg:p-2' : 'p-3'}`}>
          {isAdmin ? (
            <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${col ? 'lg:justify-center lg:px-0' : ''}`}>
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.profile_photo_url
                  ? <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold">{profile?.rider_name?.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div className={`flex-1 min-w-0 ${col ? 'lg:hidden' : ''}`}>
                <p className="font-semibold text-sm truncate">{profile?.rider_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Shield size={10} className="text-yellow-400" />
                  <span className="text-[11px] text-yellow-400 font-medium">Admin</span>
                </div>
              </div>
            </div>
          ) : (
            <Link
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              title={col ? `${profile?.rider_name} · ${roleLabel}` : undefined}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition hover:bg-white/10 ${col ? 'lg:justify-center lg:px-0' : ''}`}
            >
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/20">
                {profile?.profile_photo_url
                  ? <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold">{profile?.rider_name?.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div className={`flex-1 min-w-0 ${col ? 'lg:hidden' : ''}`}>
                <p className="font-semibold text-sm truncate leading-tight">{profile?.rider_name}</p>
                <p className="text-[11px] text-white/50 mt-0.5 truncate">{roleLabel} · {profile?.province}</p>
              </div>
              <ChevronRight size={14} className={`text-white/30 flex-shrink-0 ${col ? 'lg:hidden' : ''}`} />
            </Link>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={col ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex items-center gap-2 w-full mt-1 px-2 py-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition text-xs
              ${col ? 'justify-center' : ''}`}
          >
            {col
              ? <PanelLeftOpen  size={16} />
              : <><PanelLeftClose size={16} /><span>Collapse</span></>
            }
          </button>
        </div>

      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar — mobile only */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0"
          >
            <Menu size={24} />
          </button>

          {/* Current page title centred */}
          {currentPageLabel ? (
            <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-800 pointer-events-none">
              {currentPageLabel}
            </span>
          ) : (
            <Link to={isAdmin ? '/admin/dashboard' : '/dashboard'} className="flex items-center gap-2 min-w-0">
              <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-8 w-8 rounded-lg bg-green-50 p-1 object-contain" />
              <h1 className="text-base font-bold text-green-900 truncate">{APP_NAME}</h1>
            </Link>
          )}

          <Link to="/notifications" className="ml-auto relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 flex-shrink-0">
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Nationals countdown banner */}
        {!isAdmin && <NationalsCountdown />}

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-auto p-3 sm:p-6">
          <div className="container-page">
            {children}
          </div>
        </main>
      </div>

      <OnboardingTour />
    </div>
  )
}
