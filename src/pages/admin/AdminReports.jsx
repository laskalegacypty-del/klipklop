import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  Flag, AlertCircle, Bug, Layout as LayoutIcon, HelpCircle,
  Clock, CheckCircle, PlayCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Skeleton } from '../../components/ui'

const CATEGORY_CONFIG = {
  incorrect_info: { label: 'Incorrect info', icon: AlertCircle, class: 'bg-red-100 text-red-700 border border-red-200' },
  bug:            { label: 'Bug',            icon: Bug,         class: 'bg-orange-100 text-orange-700 border border-orange-200' },
  ui_problem:     { label: 'UI problem',      icon: LayoutIcon, class: 'bg-blue-100 text-blue-700 border border-blue-200' },
  other:          { label: 'Other',           icon: HelpCircle, class: 'bg-gray-100 text-gray-700 border border-gray-200' },
}

const STATUS_CONFIG = {
  open:        { label: 'Open',        class: 'bg-amber-100 text-amber-700 border border-amber-200' },
  in_progress: { label: 'In Progress', class: 'bg-blue-100 text-blue-700 border border-blue-200' },
  resolved:    { label: 'Resolved',    class: 'bg-green-100 text-green-700 border border-green-200' },
  wont_fix:    { label: "Won't Fix",   class: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [acting, setActing] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('problem_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setReports(data || [])
    } catch {
      toast.error('Could not load reports')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(report, status) {
    setActing(report.id)
    try {
      const patch = { status }
      if (status === 'resolved' || status === 'wont_fix') patch.resolved_at = new Date().toISOString()
      if (status === 'open' || status === 'in_progress') patch.resolved_at = null
      const { error } = await supabase.from('problem_reports').update(patch).eq('id', report.id)
      if (error) throw error
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, ...patch } : r))
      toast.success(`Marked as ${STATUS_CONFIG[status].label}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setActing(null)
    }
  }

  async function saveNote(report) {
    const note = noteDrafts[report.id] ?? report.admin_notes ?? ''
    setActing(report.id)
    try {
      const { error } = await supabase.from('problem_reports').update({ admin_notes: note }).eq('id', report.id)
      if (error) throw error
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, admin_notes: note } : r))
      toast.success('Note saved')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setActing(null)
    }
  }

  const counts = {
    all:         reports.length,
    open:        reports.filter(r => r.status === 'open').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved:    reports.filter(r => r.status === 'resolved').length,
    wont_fix:    reports.filter(r => r.status === 'wont_fix').length,
  }

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter)

  const TABS = [
    { key: 'open',        label: 'Open',        count: counts.open },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { key: 'resolved',    label: 'Resolved',    count: counts.resolved },
    { key: 'wont_fix',    label: "Won't Fix",   count: counts.wont_fix },
    { key: 'all',         label: 'All',         count: counts.all },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-green-800 rounded-lg flex items-center justify-center">
          <Flag size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Problem Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Incorrect info, bugs, and UI problems reported by users</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-amber-50 rounded-xl p-2.5"><Clock size={18} className="text-amber-500" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.open}</p>
            <p className="text-xs text-gray-500 mt-0.5">Open</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-blue-50 rounded-xl p-2.5"><PlayCircle size={18} className="text-blue-500" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.in_progress}</p>
            <p className="text-xs text-gray-500 mt-0.5">In Progress</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-50 rounded-xl p-2.5"><CheckCircle size={18} className="text-green-600" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.resolved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Resolved</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="bg-gray-50 rounded-xl p-2.5"><Flag size={18} className="text-gray-500" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{counts.all}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Reports</p>
          </div>
        </div>
      </div>

      {/* List card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-1.5 transition border-b-2 -mb-px whitespace-nowrap ${
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
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Flag size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No {filter === 'all' ? '' : STATUS_CONFIG[filter]?.label.toLowerCase() ?? ''} reports</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(report => {
              const cat = CATEGORY_CONFIG[report.category] ?? CATEGORY_CONFIG.other
              const CatIcon = cat.icon
              const isOpen = expanded === report.id
              const isBusy = acting === report.id

              return (
                <div key={report.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ${cat.class}`}>
                        <CatIcon size={12} />
                        {cat.label}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{report.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                        <span>{formatDate(report.created_at)}</span>
                        {report.page_path && <span className="truncate">{report.page_path}</span>}
                        {report.reporter_email && <span className="truncate">{report.reporter_email}</span>}
                        {(report.context || report.user_agent) && (
                          <button
                            onClick={() => setExpanded(isOpen ? null : report.id)}
                            className="inline-flex items-center gap-0.5 text-green-700 hover:text-green-900 font-medium"
                          >
                            Details {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {isOpen && (
                        <div className="mt-3 space-y-2">
                          {report.context && (
                            <pre className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words text-gray-600">
                              {JSON.stringify(report.context, null, 2)}
                            </pre>
                          )}
                          {report.user_agent && (
                            <p className="text-xs text-gray-400 break-words">{report.user_agent}</p>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Admin notes</label>
                            <textarea
                              value={noteDrafts[report.id] ?? report.admin_notes ?? ''}
                              onChange={e => setNoteDrafts(prev => ({ ...prev, [report.id]: e.target.value }))}
                              placeholder="Internal notes..."
                              className="w-full min-h-16 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <button
                              onClick={() => saveNote(report)}
                              disabled={isBusy}
                              className="mt-1.5 text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
                            >
                              Save note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CONFIG[report.status]?.class}`}>
                        {STATUS_CONFIG[report.status]?.label}
                      </span>
                      <div className="flex gap-1.5">
                        {report.status === 'open' && (
                          <button
                            onClick={() => updateStatus(report, 'in_progress')}
                            disabled={isBusy}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition disabled:opacity-50"
                          >
                            Start
                          </button>
                        )}
                        {(report.status === 'open' || report.status === 'in_progress') && (
                          <>
                            <button
                              onClick={() => updateStatus(report, 'resolved')}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold border border-green-200 transition disabled:opacity-50"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => updateStatus(report, 'wont_fix')}
                              disabled={isBusy}
                              className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200 transition disabled:opacity-50"
                            >
                              Won't Fix
                            </button>
                          </>
                        )}
                        {(report.status === 'resolved' || report.status === 'wont_fix') && (
                          <button
                            onClick={() => updateStatus(report, 'open')}
                            disabled={isBusy}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 transition disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
