import { useState, useEffect, createElement } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import toast from 'react-hot-toast'
import {
  Home,
  Calendar,
  Clock,
  BarChart2,
  User,
  Bell,
  LogOut,
  Menu,
  Shield,
  Users,
  Settings,
  HeartPulse,
  Table2,
  UserSearch,
  UsersRound
} from 'lucide-react'

const APP_NAME = 'Klipklop'
const APP_TAGLINE_USER = 'Western Mounted Games'
const APP_TAGLINE_ADMIN = 'Admin Panel'
const APP_LOGO_SRC = '/icons/icon.svg'

const userNavItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/qualifiers', label: 'Qualifiers', icon: Calendar },
  { path: '/my-times', label: 'My Times', icon: Clock },
  { path: '/tracker', label: 'Qualifier Tracker', icon: BarChart2 },
  { path: '/season', label: 'Season Overview', icon: BarChart2 },
  { path: '/horses', label: 'Horses', icon: HeartPulse },
  { path: '/matrix', label: 'Matrix', icon: Table2 },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/notifications', label: 'Notifications', icon: Bell },
]

const supporterNavItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/qualifiers', label: 'Qualifiers', icon: Calendar },
  { path: '/matrix', label: 'Matrix', icon: Table2 },
  { path: '/my-riders', label: 'My Riders', icon: UserSearch },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/notifications', label: 'Notifications', icon: Bell },
]

// Club/Family Head — manages riders, no personal times page
const clubHeadNavItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/qualifiers', label: 'Qualifiers', icon: Calendar },
  { path: '/my-club-riders', label: 'My Riders', icon: UsersRound },
  { path: '/tracker', label: 'Qualifier Tracker', icon: BarChart2 },
  { path: '/season', label: 'Season Overview', icon: BarChart2 },
  { path: '/horses', label: 'Horses', icon: HeartPulse },
  { path: '/matrix', label: 'Matrix', icon: Table2 },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/notifications', label: 'Notifications', icon: Bell },
]

// Club/Family Member — simplified read-only nav
const clubMemberNavItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/qualifiers', label: 'Qualifiers', icon: Calendar },
  { path: '/my-times', label: 'My Times', icon: Clock },
  { path: '/matrix', label: 'Matrix', icon: Table2 },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/notifications', label: 'Notifications', icon: Bell },
]

const adminNavItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/events', label: 'Events', icon: Calendar },
  { path: '/admin/matrix', label: 'Matrix & Announcements', icon: Settings },
]

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { profile, signOut, isAdmin, isSupporter, isClubHead, isClubMember } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = isAdmin
    ? adminNavItems
    : isSupporter
    ? supporterNavItems
    : isClubHead
    ? clubHeadNavItems
    : isClubMember
    ? clubMemberNavItems
    : userNavItems

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.id && !isAdmin) fetchUnreadCount()
    if (isAdmin) setUnreadCount(0)
  }, [profile, isAdmin, isSupporter, isClubHead, isClubMember])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Signed out successfully')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-green-900 text-white z-30
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>

        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link
            to={isAdmin ? '/admin/dashboard' : '/dashboard'}
            className="flex items-center gap-3"
            onClick={() => setSidebarOpen(false)}
          >
            <img
              src={APP_LOGO_SRC}
              alt={`${APP_NAME} logo`}
              className="h-10 w-10 rounded-xl bg-white/10 p-1"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">{APP_NAME}</h1>
              <p className="text-white/70 text-xs mt-0.5 truncate">
                {isAdmin ? APP_TAGLINE_ADMIN : APP_TAGLINE_USER}
              </p>
            </div>
          </Link>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center overflow-hidden">
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold">
                  {profile?.rider_name?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{profile?.rider_name}</p>
              <p className="text-white/70 text-xs truncate">{profile?.province}</p>
            </div>
            {isAdmin && (
              <Shield size={16} className="text-yellow-400 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map(({ path, label, icon }) => {
              const isActive = location.pathname === path
              const showBadge = path === '/notifications' && unreadCount > 0

              return (
                <li key={path}>
                  <Link
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition
                      ${isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    {createElement(icon, { size: 20 })}
                    <span className="text-sm font-medium flex-1">{label}</span>
                    {showBadge && (
                      <span className="bg-yellow-400 text-yellow-950 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Sign out */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition w-full"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar (mobile) */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={24} />
          </button>
          <Link
            to={isAdmin ? '/admin/dashboard' : '/dashboard'}
            className="flex items-center gap-2 min-w-0"
          >
            <img
              src={APP_LOGO_SRC}
              alt={`${APP_NAME} logo`}
              className="h-8 w-8 rounded-lg bg-green-50 p-1"
            />
            <h1 className="text-base font-bold text-green-900 truncate">{APP_NAME}</h1>
          </Link>
          {unreadCount > 0 && (
            <Link to="/notifications" className="ml-auto relative">
              <Bell size={22} className="text-gray-600" />
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="container-page">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}