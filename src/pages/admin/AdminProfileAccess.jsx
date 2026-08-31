import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { KeyRound, Search, Eye, Glasses, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton, EmptyState } from '../../components/ui'
import { isGrantActive, grantStatusLabel } from '../../lib/profileAccess'
import RequestAccessModal from '../../components/admin/RequestAccessModal'

const TABS = [
  { key: 'active',   label: 'Active' },
  { key: 'pending',  label: 'Pending' },
  { key: 'past',      label: 'Past' },
  { key: 'all',       label: 'All' },
]

function matchesTab(grant, tab) {
  if (tab === 'all') return true
  if (tab === 'pending') return grant.status === 'pending'
  if (tab === 'active') return isGrantActive(grant)
  if (tab === 'past') return grant.status === 'declined' || grant.status === 'revoked' || (grant.status === 'accepted' && !isGrantActive(grant))
  return true
}

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminProfileAccess() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')

  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [requestTarget, setRequestTarget] = useState(null)

  useEffect(() => { fetchGrants() }, [])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, rider_name, province, role')
        .neq('role', 'admin')
        .ilike('rider_name', `%${term}%`)
        .limit(8)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function fetchGrants() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profile_access_grants')
        .select('*, target:user_id (rider_name, province, profile_photo_url)')
        .eq('admin_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setGrants(data || [])
    } catch {
      toast.error('Error loading access requests')
    } finally {
      setLoading(false)
    }
  }

  const filtered = grants.filter(g => matchesTab(g, tab))

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">

      <RequestAccessModal
        open={!!requestTarget}
        onClose={() => setRequestTarget(null)}
        adminId={profile.id}
        targetUser={requestTarget}
        onRequested={() => { setSearch(''); setResults([]); fetchGrants() }}
      />

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
          <KeyRound size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Access</h1>
          <p className="text-sm text-gray-400 mt-0.5">Request time-limited, consent-based access to a rider's profile</p>
        </div>
      </div>

      {/* New request search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Request access to a profile</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search rider by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-gray-50"
          />
        </div>
        {search.trim().length >= 2 && (
          <div className="mt-2 divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
            {searching ? (
              <p className="text-sm text-gray-400 p-3">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-400 p-3">No riders found</p>
            ) : results.map(r => (
              <button
                key={r.id}
                onClick={() => setRequestTarget(r)}
                className="w-full flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.rider_name}</p>
                  <p className="text-xs text-gray-400">{r.province}</p>
                </div>
                <span className="text-xs font-semibold text-green-700">Request →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.key ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={`No ${tab === 'all' ? '' : tab} requests`}
            description="Search for a rider above to request access to their profile."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(grant => {
              const active = isGrantActive(grant)
              return (
                <div key={grant.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {grant.target?.profile_photo_url
                      ? <img src={grant.target.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-green-700 font-bold text-sm">{grant.target?.rider_name?.charAt(0).toUpperCase()}</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{grant.target?.rider_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{grant.target?.province}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                    <Clock size={12} />
                    {grant.status === 'pending' && `Requested ${formatDateTime(grant.created_at)}`}
                    {grant.status === 'accepted' && `Expires ${formatDateTime(grant.expires_at)}`}
                    {grant.status === 'declined' && 'Declined'}
                    {grant.status === 'revoked' && `Revoked ${formatDateTime(grant.revoked_at)}`}
                  </div>

                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    active ? 'bg-green-100 text-green-700 border border-green-200'
                    : grant.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {grantStatusLabel(grant)}
                  </span>

                  {active ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/admin/profile-dossier/${grant.user_id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        onClick={() => navigate(`/admin/view-as/${grant.user_id}/dashboard`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-green-300 text-green-700 hover:bg-green-50 text-xs font-semibold transition"
                      >
                        <Glasses size={13} /> View As
                      </button>
                    </div>
                  ) : grant.status === 'pending' ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 flex-shrink-0">
                      <XCircle size={13} /> Awaiting response
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
