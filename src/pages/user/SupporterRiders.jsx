import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui'
import {
  UserSearch,
  UserPlus,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  UserCheck,
  Hourglass
} from 'lucide-react'
import toast from 'react-hot-toast'
import SharedTimesView from '../../components/times/SharedTimesView'
import { buildYearOptions } from '../../lib/timesViewHelpers'

const CURRENT_YEAR = new Date().getFullYear()

// ─────────────────────────────────────────────────────────
// LinkedRiderCard — expandable card for one linked rider
// ─────────────────────────────────────────────────────────
function LinkedRiderCard({ rider, supporterId }) {
  const [expanded, setExpanded] = useState(false)
  const [combos, setCombos] = useState([])
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [horses, setHorses] = useState([])
  const [loadingCombos, setLoadingCombos] = useState(false)

  async function handleExpand() {
    if (!expanded && combos.length === 0) {
      setLoadingCombos(true)
      const [combosRes, horsesRes] = await Promise.all([
        supabase
          .from('horse_rider_combos')
          .select('*')
          .eq('user_id', rider.rider_id)
          .eq('is_archived', false)
          .order('is_pinned', { ascending: false }),
        supabase
          .from('horses')
          .select('id, name, photo_url, breed, color')
          .eq('user_id', rider.rider_id)
      ])
      const combosData = combosRes.data || []
      setCombos(combosData)
      setHorses(horsesRes.data || [])
      setSelectedCombo(combosData.find(c => c.is_pinned) || combosData[0] || null)
      setLoadingCombos(false)
    }
    setExpanded(v => !v)
  }

  function getHorsePhoto(combo) {
    if (combo.horse_id) return horses.find(h => h.id === combo.horse_id)?.photo_url || null
    return horses.find(h => h.name?.toLowerCase() === combo.horse_name?.toLowerCase())?.photo_url || null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
            {rider.profile?.profile_photo_url ? (
              <img src={rider.profile.profile_photo_url} alt={rider.profile.rider_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-green-700">
                {rider.profile?.rider_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{rider.profile?.rider_name}</p>
            <p className="text-xs text-gray-400">{rider.profile?.province || 'No province'}</p>
          </div>
        </div>

        <button
          onClick={handleExpand}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition text-sm font-medium"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? 'Collapse' : 'View Times'}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {loadingCombos ? (
            <div className="py-6 space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-32" />
            </div>
          ) : combos.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">This rider has no horse/rider combos yet.</div>
          ) : (
            <>
              {/* Combo + Year selectors */}
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Horse:</span>
                  <div className="flex gap-2 flex-wrap">
                    {combos.map(combo => (
                      <button
                        key={combo.id}
                        onClick={() => setSelectedCombo(combo)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                          selectedCombo?.id === combo.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {getHorsePhoto(combo) ? (
                          <img src={getHorsePhoto(combo)} alt={combo.horse_name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-green-300 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{combo.horse_name?.charAt(0)}</span>
                          </div>
                        )}
                        {combo.horse_name}
                        {combo.is_pinned && ' ★'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium text-gray-600">Season:</span>
                  <div className="relative inline-block">
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white font-medium"
                    >
                      {buildYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Times view for selected combo */}
              {selectedCombo && (
                <SharedTimesView combo={selectedCombo} selectedYear={selectedYear} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export default function SupporterRiders() {
  const { profile, isSupporter } = useAuth()
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState({})

  useEffect(() => {
    if (profile) fetchLinks()
  }, [profile])

  async function fetchLinks() {
    setLoading(true)
    try {
      const { data: linksData } = await supabase
        .from('supporter_rider_links')
        .select('id, rider_id, status, created_at')
        .eq('supporter_id', profile.id)
        .order('created_at', { ascending: false })

      if (!linksData || linksData.length === 0) {
        setLinks([])
        return
      }

      const riderIds = linksData.map(l => l.rider_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, rider_name, province, profile_photo_url')
        .in('id', riderIds)

      const profileMap = {}
      profiles?.forEach(p => { profileMap[p.id] = p })

      setLinks(linksData.map(link => ({
        ...link,
        profile: profileMap[link.rider_id] || null
      })))
    } catch (error) {
      toast.error('Error loading riders')
    } finally {
      setLoading(false)
    }
  }

  // Live search — debounced via useEffect below
  async function handleSearch(query) {
    const q = query.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, rider_name, province, profile_photo_url')
        .eq('role', 'user')
        .ilike('rider_name', `%${q}%`)
        .limit(8)

      // Exclude riders already linked (any status)
      const linkedIds = new Set(links.map(l => l.rider_id))
      setSearchResults((data || []).filter(p => p.id !== profile.id && !linkedIds.has(p.id)))
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  // Debounce: fire search 300 ms after the user stops typing
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => handleSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, links])

  async function sendRequest(rider) {
    setSending(s => ({ ...s, [rider.id]: true }))
    try {
      // Insert link
      const { error: linkError } = await supabase
        .from('supporter_rider_links')
        .insert({
          supporter_id: profile.id,
          rider_id: rider.id,
          status: 'pending'
        })

      if (linkError) {
        console.error('supporter_rider_links insert error:', linkError)
        if (linkError.code === '23505') {
          toast.error('You already sent a request to this rider.')
        } else if (linkError.code === '42P01') {
          toast.error('Database table not set up yet. Please ask your admin to run the supporter_rider_links.sql migration in Supabase.')
        } else {
          toast.error(`Error sending request: ${linkError.message}`)
        }
        return
      }

      // Notify the rider — fire-and-forget; failure is non-fatal
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: rider.id,
        type: 'supporter_request',
        message: `${profile.rider_name} wants to follow you as a supporter. Check your Profile to accept or decline.`,
        link: '/profile'
      })
      if (notifError) {
        // Notification failed (likely missing RLS policy) — log but don't block UX
        console.warn('Rider notification insert failed (check notifications RLS):', notifError.message)
      }

      toast.success(`Request sent to ${rider.rider_name}!`)
      setSearchResults(r => r.filter(p => p.id !== rider.id))
      fetchLinks()
    } catch (err) {
      console.error('Unexpected error in sendRequest:', err)
      toast.error('Unexpected error sending request.')
    } finally {
      setSending(s => ({ ...s, [rider.id]: false }))
    }
  }

  async function withdrawRequest(linkId) {
    try {
      const { error } = await supabase
        .from('supporter_rider_links')
        .delete()
        .eq('id', linkId)

      if (error) throw error
      toast.success('Request withdrawn')
      setLinks(prev => prev.filter(l => l.id !== linkId))
    } catch (error) {
      toast.error('Error withdrawing request')
    }
  }

  if (!isSupporter) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>This page is for supporters only.</p>
      </div>
    )
  }

  const acceptedLinks = links.filter(l => l.status === 'accepted')
  const pendingLinks = links.filter(l => l.status === 'pending')
  const rejectedLinks = links.filter(l => l.status === 'rejected')

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Riders"
        description="Follow riders and view their times and progress"
      />

      {/* Search / Add Rider */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <UserPlus size={18} className="text-gray-400" />
          Add a Rider
        </h2>
        {/* Input with live results */}
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Start typing a rider name…"
              className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {searchQuery && !searching && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {searchQuery.length >= 2 && (
            <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              {searching ? (
                <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">
                  No riders found matching <span className="font-medium text-gray-600">"{searchQuery}"</span>
                </div>
              ) : (
                searchResults.map(rider => (
                  <div
                    key={rider.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
                        {rider.profile_photo_url ? (
                          <img src={rider.profile_photo_url} alt={rider.rider_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-green-700">{rider.rider_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{rider.rider_name}</p>
                        <p className="text-xs text-gray-400">{rider.province || 'No province'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => sendRequest(rider)}
                      disabled={sending[rider.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex-shrink-0"
                    >
                      <UserPlus size={13} />
                      {sending[rider.id] ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {searchQuery.length === 1 && (
          <p className="mt-1.5 text-xs text-gray-400">Type at least 2 characters to search…</p>
        )}
      </div>

      {/* Accepted riders */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <>
          {acceptedLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Linked Riders ({acceptedLinks.length})
                </h2>
              </div>
              <div className="space-y-3">
                {acceptedLinks.map(link => (
                  <LinkedRiderCard
                    key={link.id}
                    rider={link}
                    supporterId={profile.id}
                  />
                ))}
              </div>
            </div>
          )}

          {pendingLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Hourglass size={18} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Pending Requests ({pendingLinks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {pendingLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-yellow-200 bg-yellow-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-200 bg-yellow-100 flex items-center justify-center">
                        {link.profile?.profile_photo_url ? (
                          <img src={link.profile.profile_photo_url} alt={link.profile.rider_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-yellow-700">{link.profile?.rider_name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{link.profile?.rider_name}</p>
                        <p className="text-xs text-yellow-600">Awaiting acceptance</p>
                      </div>
                    </div>
                    <button
                      onClick={() => withdrawRequest(link.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition px-2 py-1 rounded hover:bg-red-50"
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rejectedLinks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <X size={18} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Declined ({rejectedLinks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {rejectedLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-400">{link.profile?.rider_name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{link.profile?.rider_name}</p>
                        <p className="text-xs text-gray-400">Request declined</p>
                      </div>
                    </div>
                    <button
                      onClick={() => withdrawRequest(link.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition px-2 py-1 rounded hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {links.length === 0 && (
            <EmptyState
              title="No riders yet"
              description="Search for a rider by name above and send them a request."
              action={null}
            />
          )}
        </>
      )}
    </div>
  )
}
