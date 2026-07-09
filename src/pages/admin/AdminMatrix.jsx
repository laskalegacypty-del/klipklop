import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { GAMES } from '../../lib/constants'
import { MATRIX } from '../../lib/matrix'
import {
  Save, Plus, Pencil, Trash2, X, Pin, AlertTriangle, Megaphone
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '../../components/ui'
import { useTabQueryParam } from '../../lib/useTabQueryParam'

const EMPTY_ANNOUNCEMENT = { title: '', body: '', is_pinned: false, expires_at: '' }
const ADMIN_MATRIX_TABS = ['announcements', 'matrix']

const LEVEL_COLS = [
  { level: 0, label: 'L0',   th: 'text-gray-500',    td: 'bg-gray-50'     },
  { level: 1, label: 'L1',   th: 'text-blue-600',    td: 'bg-blue-50'     },
  { level: 2, label: 'L2',   th: 'text-green-600',   td: 'bg-green-50'    },
  { level: 3, label: 'L3',   th: 'text-orange-600',  td: 'bg-orange-50'   },
  { level: 4, label: 'L4',   th: 'text-red-600',     td: 'bg-red-50'      },
]

export default function AdminMatrix() {
  const [activeTab, setActiveTab] = useState('announcements')
  useTabQueryParam({ activeTab, setActiveTab, allowedTabs: ADMIN_MATRIX_TABS })

  const [announcements, setAnnouncements] = useState([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [form, setForm] = useState(EMPTY_ANNOUNCEMENT)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const [matrixData, setMatrixData] = useState({})
  const [matrixEditing, setMatrixEditing] = useState(false)
  const [matrixSaving, setMatrixSaving] = useState(false)
  const [showMatrixWarning, setShowMatrixWarning] = useState(false)
  const [affectedUsers, setAffectedUsers] = useState(0)

  useEffect(() => {
    fetchAnnouncements()
    initMatrix()
  }, [])

  function initMatrix() {
    const data = {}
    GAMES.forEach(game => {
      data[game] = { 0: MATRIX[game][0][0], 1: MATRIX[game][1][0], 2: MATRIX[game][2][0], 3: MATRIX[game][3][0], 4: MATRIX[game][4][0] }
    })
    setMatrixData(data)
  }

  async function fetchAnnouncements() {
    try {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setAnnouncements(data || [])
    } catch {
      toast.error('Error loading announcements')
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  function openAdd() {
    setEditingAnnouncement(null)
    setForm(EMPTY_ANNOUNCEMENT)
    setShowModal(true)
  }

  function openEdit(announcement) {
    setEditingAnnouncement(announcement)
    setForm({
      title: announcement.title, body: announcement.body, is_pinned: announcement.is_pinned,
      expires_at: announcement.expires_at ? new Date(announcement.expires_at).toISOString().split('T')[0] : ''
    })
    setShowModal(true)
  }

  async function handleSaveAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Please fill in title and body')
      return
    }
    setSaving(true)
    try {
      const expiresAt = form.expires_at ? new Date(`${form.expires_at}T23:59:59.999Z`).toISOString() : null
      const payload = { title: form.title, body: form.body, is_pinned: form.is_pinned, expires_at: expiresAt }

      if (editingAnnouncement) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editingAnnouncement.id)
        if (error) throw error
        toast.success('Announcement updated')
      } else {
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
        const { data: users } = await supabase.from('profiles').select('id').eq('status', 'approved').eq('role', 'user')
        if (users?.length > 0) {
          const { error: notifError } = await supabase.from('notifications').insert(
            users.map(u => ({ user_id: u.id, type: 'new_announcement', message: `New announcement: ${form.title}`, link: '/dashboard' }))
          )
          if (notifError) toast.error('Announcement posted, but notifications failed to send')
        }
        toast.success('Announcement posted')
      }
      setShowModal(false)
      fetchAnnouncements()
    } catch (error) {
      toast.error(error?.message ? `Error: ${error.message}` : 'Error saving announcement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAnnouncement(id) {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
      toast.success('Announcement deleted')
      setShowDeleteConfirm(null)
      fetchAnnouncements()
    } catch {
      toast.error('Error deleting announcement')
    }
  }

  async function checkMatrixImpact() {
    const { count } = await supabase.from('personal_bests').select('*', { count: 'exact', head: true })
    setAffectedUsers(count || 0)
    setShowMatrixWarning(true)
  }

  async function handleSaveMatrix() {
    setMatrixSaving(true)
    try {
      toast.success('Matrix updated successfully')
      setMatrixEditing(false)
      setShowMatrixWarning(false)
    } catch {
      toast.error('Error saving matrix')
    } finally {
      setMatrixSaving(false)
    }
  }

  function handleMatrixChange(game, level, value) {
    setMatrixData(prev => ({ ...prev, [game]: { ...prev[game], [level]: parseFloat(value) || 0 } }))
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title="Matrix & Announcements"
        description="Manage level thresholds and post announcements"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {ADMIN_MATRIX_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition capitalize ${
              activeTab === tab
                ? 'border-green-700 text-green-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'announcements' ? 'Announcements' : 'Level Matrix'}
          </button>
        ))}
      </div>

      {/* Announcements tab */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl hover:bg-green-800 transition text-sm font-medium shadow-sm">
              <Plus size={17} /> New Announcement
            </button>
          </div>

          {loadingAnnouncements ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 h-28 animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Megaphone size={22} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium">No announcements yet</p>
              <p className="text-xs text-gray-300 mt-1">Click "New Announcement" to post one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => {
                const isExpired = ann.expires_at && new Date(ann.expires_at) < new Date()
                return (
                  <div key={ann.id}
                    className={`bg-white rounded-2xl border shadow-sm transition ${
                      ann.is_pinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
                    } ${isExpired ? 'opacity-55' : ''}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {ann.is_pinned && (
                              <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                <Pin size={10} /> Pinned
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Expired</span>
                            )}
                            {ann.expires_at && !isExpired && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                                Expires {new Date(ann.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-gray-900 mb-1">{ann.title}</h3>
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                          <p className="text-xs text-gray-400 mt-3">
                            Posted {new Date(ann.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(ann)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(ann.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Matrix tab */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Time thresholds in seconds. Lower time = higher level achieved.</p>
            <div className="flex gap-2">
              {matrixEditing ? (
                <>
                  <button onClick={() => { setMatrixEditing(false); initMatrix() }}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
                    Cancel
                  </button>
                  <button onClick={checkMatrixImpact}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-700 rounded-xl hover:bg-green-800 transition shadow-sm">
                    <Save size={15} /> Save Matrix
                  </button>
                </>
              ) : (
                <button onClick={() => setMatrixEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-700 rounded-xl hover:bg-green-800 transition shadow-sm">
                  <Pencil size={15} /> Edit Matrix
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 bg-gray-50 sticky left-0">Game</th>
                  {LEVEL_COLS.map(col => (
                    <th key={col.level} className={`text-center px-4 py-3 font-bold ${col.th} ${col.td}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {GAMES.map((game, gi) => (
                  <tr key={game} className={gi % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium text-gray-800 text-xs whitespace-nowrap sticky left-0 bg-inherit">{game}</td>
                    {LEVEL_COLS.map(col => (
                      <td key={col.level} className={`px-3 py-3 text-center ${col.td}`}>
                        {matrixEditing ? (
                          <input
                            type="number"
                            step="0.001"
                            value={matrixData[game]?.[col.level] || ''}
                            onChange={e => handleMatrixChange(game, col.level, e.target.value)}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-center text-xs focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums bg-white"
                          />
                        ) : (
                          <span className={`font-mono text-xs font-medium ${col.th}`}>
                            {matrixData[game]?.[col.level]?.toFixed(3)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Announcement modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Announcement title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5}
                  placeholder="Write your announcement here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry Date (optional)</label>
                <input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded" />
                <span className="text-sm text-gray-700">Pin to top of users' dashboard</span>
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleSaveAnnouncement} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-700 rounded-xl hover:bg-green-800 transition disabled:opacity-50">
                <Save size={15} />
                {saving ? 'Saving...' : editingAnnouncement ? 'Update' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matrix warning */}
      {showMatrixWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-gray-900">Confirm Matrix Update</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">This change will affect the Nationals level calculation for:</p>
            <p className="text-3xl font-bold text-amber-600 mb-1 tabular-nums">{affectedUsers.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mb-2">personal best records</p>
            <p className="text-xs text-gray-400 mb-6">All users' Nationals levels will be recalculated using the new thresholds. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowMatrixWarning(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleSaveMatrix} disabled={matrixSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition disabled:opacity-50">
                <Save size={15} />
                {matrixSaving ? 'Saving...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Delete Announcement?</h3>
            <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                Cancel
              </button>
              <button onClick={() => handleDeleteAnnouncement(showDeleteConfirm)}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
