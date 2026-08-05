import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  Users, Calendar, Clock,
  ArrowRight, Shield, Megaphone, Activity, MapPin,
  BarChart2, Pin
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton } from '../../components/ui'

const CURRENT_YEAR = new Date().getFullYear()

const COLOR = {
  blue:   { bg: 'bg-blue-50',    icon: 'text-blue-500'    },
  amber:  { bg: 'bg-amber-50',   icon: 'text-amber-500'   },
  green:  { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  purple: { bg: 'bg-purple-50',  icon: 'text-purple-500'  },
  rose:   { bg: 'bg-rose-50',    icon: 'text-rose-500'    },
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0, weekResults: 0,
    totalCombos: 0, activeAnnouncements: 0
  })
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [qualifierEvents, setQualifierEvents] = useState([])
  const [resultsByEvent, setResultsByEvent] = useState({})
  const [provinceData, setProvinceData] = useState([])
  const [activityFeed, setActivityFeed] = useState([])
  const [activeAnnouncements, setActiveAnnouncements] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const yearStart = `${CURRENT_YEAR}-01-01`
      const yearEnd   = `${CURRENT_YEAR}-12-31`

      const [
        { count: totalUsers },
        { count: weekResultsCount },
        { count: totalCombos },
        upcomingRes,
        qualifierRes,
        resultIdsRes,
        provincesRes,
        recentResultsRes,
        announcementsRes
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('qualifier_results').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('horse_rider_combos').select('*', { count: 'exact', head: true }),
        supabase.from('qualifier_events').select('*').gte('date', today).order('date', { ascending: true }).limit(5),
        supabase.from('qualifier_events').select('*').eq('event_type', 'qualifier')
          .gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: true }),
        supabase.from('qualifier_results').select('event_id'),
        supabase.from('profiles').select('province').eq('status', 'approved').in('role', ['user', 'supporter', 'club_head']),
        supabase.from('qualifier_results').select(
          'combo_id, event_id, created_at, horse_rider_combos(rider_name, horse_name), qualifier_events(qualifier_number, province, date)'
        ).order('created_at', { ascending: false }).limit(60),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10)
      ])

      // Results by event
      const byEvent = {}
      resultIdsRes.data?.forEach(r => {
        byEvent[r.event_id] = (byEvent[r.event_id] || 0) + 1
      })
      setResultsByEvent(byEvent)

      // Province distribution
      const provinceCounts = {}
      provincesRes.data?.forEach(p => {
        if (p.province) provinceCounts[p.province] = (provinceCounts[p.province] || 0) + 1
      })
      setProvinceData(
        Object.entries(provinceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }))
      )

      // Activity feed: group by combo+event
      const sessions = {}
      recentResultsRes.data?.forEach(r => {
        const key = `${r.combo_id}-${r.event_id}`
        if (!sessions[key]) {
          sessions[key] = {
            riderName: r.horse_rider_combos?.rider_name || 'Unknown',
            horseName: r.horse_rider_combos?.horse_name || 'Unknown',
            qualifierNumber: r.qualifier_events?.qualifier_number,
            province: r.qualifier_events?.province,
            count: 0,
            latestAt: r.created_at
          }
        }
        sessions[key].count++
        if (r.created_at > sessions[key].latestAt) sessions[key].latestAt = r.created_at
      })
      setActivityFeed(
        Object.values(sessions).sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt)).slice(0, 8)
      )

      // Active announcements
      const now = new Date()
      const active = announcementsRes.data?.filter(a => !a.expires_at || new Date(a.expires_at) > now) || []
      setActiveAnnouncements(active)

      setStats({
        totalUsers: totalUsers || 0,
        weekResults: weekResultsCount || 0,
        totalCombos: totalCombos || 0,
        activeAnnouncements: active.length
      })
      setUpcomingEvents(upcomingRes.data || [])
      setQualifierEvents(qualifierRes.data || [])

    } catch (error) {
      console.error(error)
      toast.error('Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const nextEvent = upcomingEvents[0]
  const nextEventDays = nextEvent
    ? Math.ceil((new Date(nextEvent.date) - new Date()) / 86400000)
    : null
  const maxResultCount = Math.max(...qualifierEvents.map(e => resultsByEvent[e.id] || 0), 1)
  const maxProvinceCount = Math.max(...provinceData.map(p => p.count), 1)

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-gray-400 pl-10">
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pl-10 sm:pl-0">
          {nextEvent && nextEventDays !== null && nextEventDays <= 7 && (
            <Link to="/admin/events"
              className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2 hover:bg-blue-100 transition">
              <Calendar size={13} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">
                {nextEvent.qualifier_number ? `Q${nextEvent.qualifier_number}` : 'Event'} in {nextEventDays === 0 ? 'today!' : `${nextEventDays}d`}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}     label="Active Members"     value={stats.totalUsers}          color="blue"   />
        <StatCard icon={Clock}     label="Results This Week"  value={stats.weekResults}          color="green"  />
        <StatCard icon={BarChart2} label="Active Combos"      value={stats.totalCombos}          color="purple" />
        <StatCard icon={Megaphone} label="Live Notices"       value={stats.activeAnnouncements}  color="rose"   />
      </div>

      {/* Season Overview + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Season Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Season {CURRENT_YEAR} — Qualifier Progress</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {qualifierEvents.filter(e => (resultsByEvent[e.id] || 0) > 0).length} of {qualifierEvents.length} qualifiers have results entered
              </p>
            </div>
            <Link to="/admin/events" className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1">
              Manage <ArrowRight size={11} />
            </Link>
          </div>

          {qualifierEvents.length === 0 ? (
            <div className="py-14 text-center">
              <Calendar size={28} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">No qualifier events for {CURRENT_YEAR}</p>
              <Link to="/admin/events" className="text-xs text-green-700 font-medium mt-2 inline-block hover:underline">
                Add events →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {qualifierEvents.map(event => {
                const count = resultsByEvent[event.id] || 0
                const isPast = new Date(event.date) < new Date()
                const daysAway = Math.ceil((new Date(event.date) - new Date()) / 86400000)
                const isThisWeek = !isPast && daysAway <= 7
                const pct = maxResultCount > 0 ? Math.round((count / maxResultCount) * 100) : 0
                const d = new Date(event.date)

                return (
                  <div key={event.id} className={`px-5 py-3 flex items-center gap-4 ${isThisWeek ? 'bg-green-50/50' : ''}`}>
                    {/* Date */}
                    <div className="w-9 text-center flex-shrink-0">
                      <p className="text-[10px] text-gray-400 font-medium uppercase leading-none">
                        {d.toLocaleDateString('en-ZA', { month: 'short' })}
                      </p>
                      <p className="text-base font-bold text-gray-700 leading-snug">
                        {d.toLocaleDateString('en-ZA', { day: '2-digit' })}
                      </p>
                    </div>

                    {/* Q badge + status */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 w-20">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        isPast && count > 0 ? 'bg-green-100 text-green-700'
                          : isPast          ? 'bg-gray-100 text-gray-400'
                          : isThisWeek      ? 'bg-green-100 text-green-700'
                                            : 'bg-blue-100 text-blue-600'
                      }`}>
                        Q{event.qualifier_number}
                      </span>
                    </div>

                    {/* Province */}
                    <div className="w-28 hidden sm:flex items-center gap-1 flex-shrink-0">
                      <MapPin size={10} className="text-gray-300 flex-shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{event.province}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1 flex items-center gap-3">
                      {count > 0 ? (
                        <>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isPast ? 'bg-green-500' : 'bg-blue-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 tabular-nums font-semibold w-16 text-right flex-shrink-0">
                            {count} results
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300 italic">
                          {isPast ? 'No results yet' : isThisWeek ? 'Coming this week' : `in ${daysAway}d`}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column: Upcoming Events + Announcements */}
        <div className="space-y-4">

          {/* Upcoming Events */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Upcoming Events</h2>
              <Link to="/admin/events" className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1">
                Add <ArrowRight size={11} />
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">No upcoming events</p>
                <Link to="/admin/events" className="text-xs text-green-700 font-medium mt-2 inline-block hover:underline">
                  Schedule one →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingEvents.map(event => {
                  const d = new Date(event.date)
                  const daysAway = Math.ceil((d - new Date()) / 86400000)
                  return (
                    <div key={event.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="flex-shrink-0 w-11 text-center bg-green-50 rounded-xl py-2 border border-green-100">
                        <p className="text-[10px] font-semibold text-green-600 uppercase leading-none">
                          {d.toLocaleDateString('en-ZA', { month: 'short' })}
                        </p>
                        <p className="text-xl font-bold text-green-800 leading-tight">
                          {d.toLocaleDateString('en-ZA', { day: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {event.qualifier_number && (
                            <span className="text-xs font-bold bg-green-800 text-white px-1.5 py-0.5 rounded">
                              Q{event.qualifier_number}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `in ${daysAway}d`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{event.venue || event.province}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active Announcements */}
          {activeAnnouncements.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Active Announcements</h2>
                <Link to="/admin/matrix" className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1">
                  Manage <ArrowRight size={11} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {activeAnnouncements.slice(0, 3).map(ann => (
                  <div key={ann.id} className="px-5 py-3 flex items-start gap-2">
                    {ann.is_pinned && <Pin size={10} className="text-amber-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ann.title}</p>
                      {ann.expires_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Expires {new Date(ann.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Province Activity + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Province Activity */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Users by Province</h2>
            <p className="text-xs text-gray-400 mt-0.5">Approved accounts</p>
          </div>
          {provinceData.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No province data</div>
          ) : (
            <div className="px-5 py-5 space-y-3.5">
              {provinceData.map(({ name, count }) => {
                const pct = Math.round((count / maxProvinceCount) * 100)
                return (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-gray-600 truncate flex-shrink-0 font-medium">{name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-7 text-right text-xs font-bold text-gray-700 tabular-nums flex-shrink-0">{count}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest results entered by riders</p>
          </div>
          {activityFeed.length === 0 ? (
            <div className="py-12 text-center">
              <Activity size={28} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">No results entered yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activityFeed.map((item, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-700 font-bold text-xs">{item.riderName?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.riderName} · {item.horseName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.count} result{item.count !== 1 ? 's' : ''}
                      {item.qualifierNumber ? ` · Q${item.qualifierNumber}` : ''}
                      {item.province ? ` · ${item.province}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(item.latestAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionTile to="/admin/users"  icon={Users}     label="Manage Users"           description="Approve, suspend, and edit member accounts"    color="blue"   />
          <ActionTile to="/admin/events" icon={Calendar}  label="Manage Events"          description="Add or update qualifier and event dates"        color="green"  />
          <ActionTile to="/admin/matrix" icon={Megaphone} label="Announcements & Matrix" description="Post notices and manage level time thresholds"  color="purple" />
        </div>
      </div>

    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, alert }) {
  const c = COLOR[color]
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${alert ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className={`${c.bg} rounded-xl p-2.5 flex-shrink-0`}>
        <Icon size={20} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )
}

function ActionTile({ to, icon: Icon, label, description, color }) {
  const c = COLOR[color]
  return (
    <Link to={to} className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition-all block">
      <div className={`${c.bg} rounded-xl w-10 h-10 flex items-center justify-center mb-3`}>
        <Icon size={20} className={c.icon} />
      </div>
      <p className="font-semibold text-gray-900 text-sm">{label}</p>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      <span className={`text-xs ${c.icon} font-medium mt-3 flex items-center gap-1 group-hover:gap-2 transition-all`}>
        Open <ArrowRight size={11} />
      </span>
    </Link>
  )
}
