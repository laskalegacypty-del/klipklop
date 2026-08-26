import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CheckCircle, XCircle, Clock, Users, Shield, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton } from '../../components/ui'

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  class: 'bg-amber-100 text-amber-700 border border-amber-200' },
  approved: { label: 'Approved', class: 'bg-green-100 text-green-700 border border-green-200' },
  rejected: { label: 'Rejected', class: 'bg-red-100  text-red-700  border border-red-200'  },
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminKlippies() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [acting, setActing] = useState(null) // id being approved/rejected

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('klippies_access_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests(data || [])
    } catch {
      toast.error('Could not load access requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(req) {
    setActing(req.id)
    try {
      const { error } = await supabase
        .from('klippies_access_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', req.id)
      if (error) throw error
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved', approved_at: new Date().toISOString() } : r))
      toast.success(`${req.name} approved`)
    } catch {
      toast.error('Failed to approve')
    } finally {
      setActing(null)
    }
  }

  async function handleReject(req) {
    setActing(req.id)
    try {
      const { error } = await supabase
        .from('klippies_access_requests')
        .update({ status: 'rejected' })
        .eq('id', req.id)
      if (error) throw error
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r))
      toast.success(`${req.name} rejected`)
    } catch {
      toast.error('Failed to reject')
    } finally {
      setActing(null)
    }
  }

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === 'filter')

  const filtered = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter)

  const TABS = [
    { key: 'pending',  label: 'Pending',  count: counts.pending  },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
    { key: 'all',      label: 'All',      count: counts.all      },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
          <MessageSquare size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klippies Access</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage who can access the Klippies AI demo</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-amber-50 rounded-xl p-2.5"><Clock size={18} className="text-amber-500" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.pending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-50 rounded-xl p-2.5"><CheckCircle size={18} className="text-green-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.approved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Approved</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-blue-50 rounded-xl p-2.5"><Users size={18} className="text-blue-500" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.all}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Requests</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-1.5 transition border-b-2 -mb-px ${
                filter === tab.key
                  ? 'border-green-700 text-green-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                filter === tab.key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Shield size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No {filter === 'all' ? '' : filter} requests</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(req => (
              <div key={req.id} className="px-5 py-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 font-bold text-sm">
                    {req.name?.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{req.name}</p>
                  <p className="text-xs text-gray-500 truncate">{req.email}</p>
                </div>

                {/* Date */}
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>
                  {req.status === 'approved' && req.approved_at && (
                    <p className="text-xs text-green-600">Approved {formatDate(req.approved_at)}</p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_CONFIG[req.status]?.class}`}>
                  {STATUS_CONFIG[req.status]?.label}
                </span>

                {/* Actions (pending only) */}
                {req.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={acting === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      <CheckCircle size={13} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={acting === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
